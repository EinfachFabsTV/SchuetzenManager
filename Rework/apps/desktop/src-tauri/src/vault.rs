// First-run password + recovery-code vault for the desktop app's local
// SQLite database. Prisma's SQLite driver (its own Rust query engine) has
// no SQLCipher support, so it can't transparently read/write an encrypted
// file - instead this module does whole-file envelope encryption entirely
// before the Node sidecar (and therefore Prisma) is ever started:
//
//   - one random 256-bit Data Encryption Key (DEK) encrypts the whole
//     SQLite file with AES-256-GCM
//   - the DEK is wrapped twice, independently, under Argon2id-derived
//     Key-Encryption-Keys: once from the user's password, once from a
//     generated recovery code. Either secret alone unwraps the DEK.
//
// On disk (under app_data_dir()): `vault.json` (metadata only - Argon2
// params, salts, wrapped DEKs, DB nonce - never a plaintext secret or
// key), `database.db.enc` (ciphertext, present whenever the app isn't
// running), and `database.db` (plaintext working copy, exists only while
// unlocked; the Fastify/Prisma sidecar reads/writes this file exactly as
// it always has, with no knowledge that encryption exists at all).
use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use data_encoding::{Specification, BASE64};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use zeroize::Zeroize;

const DEK_LEN: usize = 32;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const RECOVERY_CODE_BYTES: usize = 20;
const BACKEND_PORT: u16 = 3001;

// Prefix of the folder a reset moves the old vault into. Also read by the
// NSIS installer hooks, which reproduce this naming when the user chooses
// to reset during a manual install - keep the two in sync.
const RESET_BACKUP_PREFIX: &str = "reset-backup-";

// The vault files a reset moves aside, in the order they are moved. The
// plaintext database.db is included because a hard kill can leave one
// behind (see reencrypt_on_exit).
const VAULT_FILE_NAMES: [&str; 5] = [
    "database.db.enc",
    "vault.json",
    "database.db.enc.bak",
    "vault.json.bak",
    "database.db",
];

// argon2id, tuned for a once-per-launch human-facing operation, not a hot
// path. m=19MiB/t=2/p=1 is RFC 9106's second recommended option / OWASP's
// baseline, chosen over a heavier profile since this also needs to run
// acceptably on lower-end hardware, and vault_unlock's auto-detect (see
// vault_unlock below) may run it twice per attempt.
const ARGON2_MEM_KIB: u32 = 19 * 1024;
const ARGON2_TIME_COST: u32 = 2;
const ARGON2_PARALLELISM: u32 = 1;

#[derive(Serialize, Deserialize, Clone)]
pub struct KdfParams {
    pub mem_kib: u32,
    pub time_cost: u32,
    pub parallelism: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        KdfParams {
            mem_kib: ARGON2_MEM_KIB,
            time_cost: ARGON2_TIME_COST,
            parallelism: ARGON2_PARALLELISM,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct WrappedKey {
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Serialize, Deserialize)]
pub struct VaultMeta {
    pub version: u8,
    pub kdf: KdfParams,
    pub password_wrap: WrappedKey,
    pub recovery_wrap: WrappedKey,
    pub db_nonce: String,
}

struct VaultUnlocked {
    dek: [u8; DEK_LEN],
    plain_db_path: PathBuf,
    enc_db_path: PathBuf,
    vault_json_path: PathBuf,
}

impl Drop for VaultUnlocked {
    fn drop(&mut self) {
        self.dek.zeroize();
    }
}

pub struct VaultState(Mutex<Option<VaultUnlocked>>);

impl VaultState {
    pub fn new() -> Self {
        VaultState(Mutex::new(None))
    }
}

struct VaultPaths {
    vault_json: PathBuf,
    enc_db: PathBuf,
    plain_db: PathBuf,
}

fn resolve_vault_paths(app: &tauri::AppHandle) -> Result<VaultPaths, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir() failed: {e}"))?;
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("could not create app data dir: {e}"))?;
    Ok(VaultPaths {
        vault_json: app_data_dir.join("vault.json"),
        enc_db: app_data_dir.join("database.db.enc"),
        plain_db: app_data_dir.join("database.db"),
    })
}

// Keeps a one-generation-back backup of the encrypted database and its
// metadata (database.db.enc.bak / vault.json.bak) so a user's data can
// never be silently lost - not by a failed update, a crash mid-write, or a
// corrupted re-encrypt. Called on every unlock *before* the running session
// can overwrite anything, so the .bak always holds the last known-good
// state. Best-effort: a backup failure is logged but does not block unlock.
fn backup_vault(paths: &VaultPaths) {
    for (src, suffix) in [(&paths.enc_db, "database.db.enc.bak"), (&paths.vault_json, "vault.json.bak")] {
        if src.exists() {
            if let Some(dir) = src.parent() {
                if let Err(e) = fs::copy(src, dir.join(suffix)) {
                    log::error!("Konnte Sicherungskopie {suffix} nicht schreiben: {e}");
                }
            }
        }
    }
}

fn crockford() -> data_encoding::Encoding {
    let mut spec = Specification::new();
    // Crockford base32: excludes I/L/O/U to avoid confusion with 1/0 when
    // a user hand-writes or re-types the recovery code.
    spec.symbols.push_str("0123456789ABCDEFGHJKMNPQRSTVWXYZ");
    spec.encoding().expect("valid crockford base32 spec")
}

fn random_bytes(len: usize) -> Vec<u8> {
    let mut buf = vec![0u8; len];
    rand::thread_rng().fill_bytes(&mut buf);
    buf
}

/// 20 random bytes (160 bits) Crockford-base32-encoded (32 chars, divides
/// evenly at 5 bits/char - no padding needed) and grouped into 8 blocks of
/// 4 for readability: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.
pub fn generate_recovery_code() -> String {
    let bytes = random_bytes(RECOVERY_CODE_BYTES);
    let encoded = crockford().encode(&bytes);
    encoded
        .as_bytes()
        .chunks(4)
        .map(|c| std::str::from_utf8(c).expect("crockford output is ASCII"))
        .collect::<Vec<_>>()
        .join("-")
}

fn derive_kek(secret: &str, salt: &[u8], params: &KdfParams) -> Result<[u8; 32], String> {
    let argon2_params = Params::new(params.mem_kib, params.time_cost, params.parallelism, Some(32))
        .map_err(|e| format!("invalid argon2 params: {e}"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon2_params);
    let mut out = [0u8; 32];
    argon2
        .hash_password_into(secret.as_bytes(), salt, &mut out)
        .map_err(|e| format!("key derivation failed: {e}"))?;
    Ok(out)
}

fn aead_encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<([u8; NONCE_LEN], Vec<u8>), String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce_bytes: [u8; NONCE_LEN] = random_bytes(NONCE_LEN)
        .try_into()
        .expect("random_bytes returns the requested length");
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, Payload { msg: plaintext, aad: b"" })
        .map_err(|e| format!("encryption failed: {e}"))?;
    Ok((nonce_bytes, ciphertext))
}

fn aead_decrypt(key: &[u8; 32], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, Payload { msg: ciphertext, aad: b"" })
        // Deliberately generic: an AES-GCM auth failure means either a
        // wrong key or tampered/corrupt data - callers surface this
        // uniformly as "wrong password/code" without distinguishing.
        .map_err(|_| "decryption failed".to_string())
}

fn wrap_dek(dek: &[u8; DEK_LEN], secret: &str, params: &KdfParams) -> Result<WrappedKey, String> {
    let salt = random_bytes(SALT_LEN);
    let mut kek = derive_kek(secret, &salt, params)?;
    let (nonce, ciphertext) = aead_encrypt(&kek, dek)?;
    kek.zeroize();
    Ok(WrappedKey {
        salt: BASE64.encode(&salt),
        nonce: BASE64.encode(&nonce),
        ciphertext: BASE64.encode(&ciphertext),
    })
}

fn unwrap_dek(wrapped: &WrappedKey, secret: &str, params: &KdfParams) -> Result<[u8; DEK_LEN], String> {
    let salt = BASE64
        .decode(wrapped.salt.as_bytes())
        .map_err(|e| format!("invalid vault data: {e}"))?;
    let nonce = BASE64
        .decode(wrapped.nonce.as_bytes())
        .map_err(|e| format!("invalid vault data: {e}"))?;
    let ciphertext = BASE64
        .decode(wrapped.ciphertext.as_bytes())
        .map_err(|e| format!("invalid vault data: {e}"))?;
    let mut kek = derive_kek(secret, &salt, params)?;
    let plaintext = aead_decrypt(&kek, &nonce, &ciphertext)?;
    kek.zeroize();
    plaintext
        .try_into()
        .map_err(|_| "unwrapped key has unexpected length".to_string())
}

/// Encrypts the whole file at `plain_path` into `enc_path`, returns the
/// base64 nonce (the caller must persist this into vault.json's db_nonce -
/// it changes on every call since a fresh random nonce is used each time).
fn encrypt_file(dek: &[u8; DEK_LEN], plain_path: &Path, enc_path: &Path) -> Result<String, String> {
    let data = fs::read(plain_path).map_err(|e| format!("read plaintext db: {e}"))?;
    let (nonce, ciphertext) = aead_encrypt(dek, &data)?;
    fs::write(enc_path, &ciphertext).map_err(|e| format!("write ciphertext db: {e}"))?;
    Ok(BASE64.encode(&nonce))
}

fn decrypt_file(dek: &[u8; DEK_LEN], enc_path: &Path, nonce_b64: &str, plain_path: &Path) -> Result<(), String> {
    let nonce = BASE64
        .decode(nonce_b64.as_bytes())
        .map_err(|e| format!("invalid vault data: {e}"))?;
    let ciphertext = fs::read(enc_path).map_err(|e| format!("read ciphertext db: {e}"))?;
    let data = aead_decrypt(dek, &nonce, &ciphertext)?;
    fs::write(plain_path, &data).map_err(|e| format!("write plaintext db: {e}"))?;
    Ok(())
}

fn update_db_nonce(vault_json_path: &Path, new_nonce: &str) -> Result<(), String> {
    let meta_json = fs::read_to_string(vault_json_path).map_err(|e| format!("could not read vault metadata: {e}"))?;
    let mut meta: VaultMeta = serde_json::from_str(&meta_json).map_err(|e| format!("could not parse vault metadata: {e}"))?;
    meta.db_nonce = new_nonce.to_string();
    let updated = serde_json::to_string_pretty(&meta).map_err(|e| format!("could not serialize vault metadata: {e}"))?;
    fs::write(vault_json_path, updated).map_err(|e| format!("could not write vault metadata: {e}"))?;
    Ok(())
}

fn wait_for_port(port: u16, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    loop {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err("Backend wurde nicht rechtzeitig bereit.".to_string());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[tauri::command]
pub fn vault_status(app: tauri::AppHandle) -> Result<String, String> {
    let paths = resolve_vault_paths(&app)?;
    Ok(if paths.vault_json.exists() {
        "locked".to_string()
    } else {
        "no_vault".to_string()
    })
}

#[tauri::command]
pub fn vault_setup(app: tauri::AppHandle, password: String) -> Result<String, String> {
    let paths = resolve_vault_paths(&app)?;
    if paths.vault_json.exists() {
        return Err("Es existiert bereits ein eingerichteter Tresor.".to_string());
    }
    if password.chars().count() < 8 {
        return Err("Das Passwort muss mindestens 8 Zeichen lang sein.".to_string());
    }

    let mut dek = [0u8; DEK_LEN];
    rand::thread_rng().fill_bytes(&mut dek);
    let recovery_code = generate_recovery_code();

    let kdf = KdfParams::default();
    let password_wrap = wrap_dek(&dek, &password, &kdf)?;
    let recovery_wrap = wrap_dek(&dek, &recovery_code, &kdf)?;

    // Seed the plaintext working copy: reuse it if a previous (as-yet
    // unencrypted) installation already left one behind, otherwise seed
    // from the pre-migrated template shipped with the app.
    if !paths.plain_db.exists() {
        let template_db = crate::resolve_template_db()?;
        fs::copy(&template_db, &paths.plain_db).map_err(|e| {
            format!(
                "could not seed database from template ({} -> {}, exists={}): {e}",
                template_db.display(),
                paths.plain_db.display(),
                template_db.exists()
            )
        })?;
    }

    let db_nonce = encrypt_file(&dek, &paths.plain_db, &paths.enc_db)?;

    let meta = VaultMeta {
        version: 1,
        kdf,
        password_wrap,
        recovery_wrap,
        db_nonce,
    };
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| format!("could not serialize vault metadata: {e}"))?;
    fs::write(&paths.vault_json, meta_json).map_err(|e| format!("could not write vault metadata: {e}"))?;

    // Register the DEK/paths before attempting to spawn the sidecar: the
    // plaintext database.db is already sitting on disk at this point
    // (freshly seeded and encrypted above), so even if the sidecar spawn
    // below fails for any reason, RunEvent::Exit still knows how to
    // re-encrypt and clean it up instead of leaving it as plaintext
    // indefinitely with no DEK on record.
    app.state::<VaultState>().0.lock().unwrap().replace(VaultUnlocked {
        dek,
        plain_db_path: paths.plain_db.clone(),
        enc_db_path: paths.enc_db,
        vault_json_path: paths.vault_json,
    });

    let child = crate::start_backend_sidecar(&app, &paths.plain_db)?;
    app.state::<crate::SidecarState>().0.lock().unwrap().replace(child);
    wait_for_port(BACKEND_PORT, Duration::from_secs(5))?;

    Ok(recovery_code)
}

#[tauri::command]
pub fn vault_unlock(app: tauri::AppHandle, secret: String) -> Result<(), String> {
    let paths = resolve_vault_paths(&app)?;
    if !paths.vault_json.exists() {
        return Err("Kein Tresor eingerichtet.".to_string());
    }
    // Snapshot the last known-good encrypted DB before this session can
    // touch anything (data-loss insurance across updates/crashes).
    backup_vault(&paths);
    let meta_json = fs::read_to_string(&paths.vault_json).map_err(|e| format!("could not read vault metadata: {e}"))?;
    let meta: VaultMeta = serde_json::from_str(&meta_json).map_err(|e| format!("could not parse vault metadata: {e}"))?;

    let wrong_secret_err = || "Falsches Passwort oder falscher Wiederherstellungscode.".to_string();

    // A leftover plaintext copy only means "the app was killed rather than
    // closed cleanly, trust it" if it's actually newer than the ciphertext.
    // Comparing mere existence isn't enough: reencrypt_on_exit's delete can
    // itself fail (observed in testing - the sidecar can still hold the
    // file open for a moment after being killed), which would otherwise
    // leave a *stale* plaintext file that this branch would wrongly prefer
    // over a freshly-written, newer database.db.enc.
    let plain_is_newer = match (fs::metadata(&paths.plain_db), fs::metadata(&paths.enc_db)) {
        (Ok(plain_meta), Ok(enc_meta)) => match (plain_meta.modified(), enc_meta.modified()) {
            (Ok(plain_time), Ok(enc_time)) => plain_time > enc_time,
            // If we can't compare timestamps, fall back to the old
            // existence-only behavior (still correct for a genuine crash,
            // since there's no ciphertext-metadata-read failure in the
            // normal case).
            _ => true,
        },
        (Ok(_), Err(_)) => true, // enc_db missing entirely - only the plaintext can be right
        _ => false,
    };

    let dek = if plain_is_newer {
        // The app was previously killed rather than closed cleanly (or the
        // last clean exit's delete-after-reencrypt failed): the leftover
        // plaintext copy is newer than database.db.enc. Trust it instead
        // of overwriting it with the older ciphertext - we still need to
        // recover the DEK (to re-encrypt correctly on the next clean
        // exit), but skip decrypt_file entirely.
        unwrap_dek(&meta.password_wrap, &secret, &meta.kdf)
            .or_else(|_| unwrap_dek(&meta.recovery_wrap, &secret, &meta.kdf))
            .map_err(|_| wrong_secret_err())?
    } else {
        let dek = unwrap_dek(&meta.password_wrap, &secret, &meta.kdf)
            .or_else(|_| unwrap_dek(&meta.recovery_wrap, &secret, &meta.kdf))
            .map_err(|_| wrong_secret_err())?;
        decrypt_file(&dek, &paths.enc_db, &meta.db_nonce, &paths.plain_db)?;
        dek
    };

    // See the matching comment in vault_setup: register the DEK before
    // attempting the sidecar spawn, so a spawn failure still leaves
    // RunEvent::Exit able to re-encrypt and clean up the plaintext copy.
    app.state::<VaultState>().0.lock().unwrap().replace(VaultUnlocked {
        dek,
        plain_db_path: paths.plain_db.clone(),
        enc_db_path: paths.enc_db,
        vault_json_path: paths.vault_json,
    });

    let child = crate::start_backend_sidecar(&app, &paths.plain_db)?;
    app.state::<crate::SidecarState>().0.lock().unwrap().replace(child);
    wait_for_port(BACKEND_PORT, Duration::from_secs(5))?;

    Ok(())
}

#[tauri::command]
pub fn vault_change_password(app: tauri::AppHandle, current_secret: String, new_password: String) -> Result<(), String> {
    let paths = resolve_vault_paths(&app)?;
    if !paths.vault_json.exists() {
        return Err("Kein Tresor eingerichtet.".to_string());
    }
    if new_password.chars().count() < 8 {
        return Err("Das Passwort muss mindestens 8 Zeichen lang sein.".to_string());
    }
    let meta_json = fs::read_to_string(&paths.vault_json).map_err(|e| format!("could not read vault metadata: {e}"))?;
    let mut meta: VaultMeta = serde_json::from_str(&meta_json).map_err(|e| format!("could not parse vault metadata: {e}"))?;

    // Auto-detect against either wrap, same pattern as vault_unlock - a
    // user who only remembers their recovery code can still set a new
    // password without that being a security downgrade (either secret
    // already grants full access).
    let dek = unwrap_dek(&meta.password_wrap, &current_secret, &meta.kdf)
        .or_else(|_| unwrap_dek(&meta.recovery_wrap, &current_secret, &meta.kdf))
        .map_err(|_| "Falsches Passwort oder falscher Wiederherstellungscode.".to_string())?;

    // Re-wrap the SAME DEK under the new password (fresh salt/nonce). The
    // DEK never changes, so: the already-decrypted running database.db
    // needs no re-encryption, db_nonce is untouched, and recovery_wrap /
    // the recovery code keep working exactly as before.
    meta.password_wrap = wrap_dek(&dek, &new_password, &meta.kdf)?;

    let updated = serde_json::to_string_pretty(&meta).map_err(|e| format!("could not serialize vault metadata: {e}"))?;
    fs::write(&paths.vault_json, updated).map_err(|e| format!("could not write vault metadata: {e}"))?;
    Ok(())
}

// Converts a day count since the Unix epoch into a civil (year, month,
// day). This is Howard Hinnant's well-known days-from-civil inverse; it is
// here so the one place that needs a human-readable timestamp doesn't drag
// a whole date crate into the dependency tree. Backup folder names are
// read by people deciding which copy to keep, so a bare epoch number would
// be a poor trade.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as i64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// UTC timestamp as `YYYY-MM-DD-HHMMSS`, used to name a reset backup folder.
fn format_timestamp(now: SystemTime) -> String {
    // A clock before the epoch would be nonsense here; falling back to 0
    // still yields a usable (if wrong) folder name rather than failing a
    // reset the user urgently needs.
    let secs = now.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) as i64;
    let (y, m, d) = civil_from_days(secs.div_euclid(86_400));
    let tod = secs.rem_euclid(86_400);
    format!(
        "{y:04}-{m:02}-{d:02}-{:02}{:02}{:02}",
        tod / 3600,
        (tod % 3600) / 60,
        tod % 60
    )
}

/// Moves one file, tolerating the two ways this realistically fails: the
/// destination being on another volume (rename can't cross filesystems),
/// and the file still being held open for a moment by the just-killed
/// sidecar - the same race reencrypt_on_exit already retries around.
fn move_file(src: &Path, dst: &Path) -> Result<(), String> {
    let mut last_err = None;
    for attempt in 0..10 {
        if fs::rename(src, dst).is_ok() {
            return Ok(());
        }
        match fs::copy(src, dst).and_then(|_| fs::remove_file(src)) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                if attempt < 9 {
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
        }
    }
    Err(format!(
        "Konnte {} nicht sichern: {}",
        src.display(),
        last_err.map(|e| e.to_string()).unwrap_or_default()
    ))
}

/// Moves the vault aside into a fresh timestamped backup folder and returns
/// that folder. Deliberately moves rather than deletes: for a locked-out
/// user the data is unreadable but not worthless - if the recovery code
/// turns up later, everything here is still recoverable.
///
/// Takes the directory and timestamp explicitly (rather than reading them
/// from an AppHandle) so it can be unit-tested without a running app.
fn move_vault_aside(app_data_dir: &Path, timestamp: &str) -> Result<PathBuf, String> {
    // Only one generation is kept: a reset frees a user from a vault they
    // can't open, it isn't a backup feature, and copies of an unopenable
    // database shouldn't accumulate on disk forever.
    if let Ok(entries) = fs::read_dir(app_data_dir) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with(RESET_BACKUP_PREFIX) {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }

    let backup_dir = app_data_dir.join(format!("{RESET_BACKUP_PREFIX}{timestamp}"));
    fs::create_dir_all(&backup_dir).map_err(|e| format!("Konnte Sicherungsordner nicht anlegen: {e}"))?;

    for name in VAULT_FILE_NAMES {
        let src = app_data_dir.join(name);
        if src.exists() {
            // A failure aborts and leaves everything else in place: a
            // visibly half-done reset is recoverable, a silently mangled
            // one is not.
            move_file(&src, &backup_dir.join(name))?;
        }
    }
    Ok(backup_dir)
}

/// Wipes the vault so the app returns to first-run setup, keeping the old
/// (still encrypted) files in a backup folder whose path is returned.
///
/// This is the way back for someone who has lost both their password and
/// their recovery code - without it, reinstalling doesn't help, since the
/// uninstaller leaves the data directory in place and a fresh install finds
/// the very same vault again.
#[tauri::command]
pub fn vault_reset(app: tauri::AppHandle) -> Result<String, String> {
    let paths = resolve_vault_paths(&app)?;
    let app_data_dir = paths
        .vault_json
        .parent()
        .ok_or_else(|| "Datenverzeichnis nicht auffindbar.".to_string())?
        .to_path_buf();

    // Order matters, and getting it wrong loses the reset silently.
    //
    // The sidecar holds database.db open, and Windows refuses to move an
    // open file. More subtly, VaultState still holds the DEK and the
    // plaintext path: if it survived this call, reencrypt_on_exit would on
    // shutdown write the database we just moved aside straight back out -
    // undoing the reset without any error ever being shown.
    if let Some(child) = app.state::<crate::SidecarState>().0.lock().unwrap().take() {
        let _ = child.kill();
    }
    app.state::<VaultState>().0.lock().unwrap().take();

    let backup_dir = move_vault_aside(&app_data_dir, &format_timestamp(SystemTime::now()))?;
    log::info!("Tresor zurückgesetzt, Sicherung unter {}", backup_dir.display());
    Ok(backup_dir.to_string_lossy().to_string())
}

/// Called from the RunEvent::Exit handler in lib.rs: re-encrypts the
/// plaintext working copy and deletes it, so nothing sensitive remains on
/// disk while the app isn't running. Best-effort - RunEvent::Exit can't
/// propagate errors, so failures are logged, not surfaced. A hard kill
/// (Task Manager, power loss) skips this and leaves the plaintext file
/// behind; vault_unlock's crash-recovery branch above picks that up
/// correctly (and safely) on the next launch instead of silently rolling
/// back to stale ciphertext.
pub fn reencrypt_on_exit(state: &VaultState) {
    let Some(unlocked) = state.0.lock().unwrap().take() else {
        return;
    };
    match encrypt_file(&unlocked.dek, &unlocked.plain_db_path, &unlocked.enc_db_path) {
        Ok(new_nonce) => {
            if let Err(e) = update_db_nonce(&unlocked.vault_json_path, &new_nonce) {
                log::error!("Konnte Vault-Metadaten beim Beenden nicht aktualisieren: {e}");
            }
            // The sidecar's kill() (called just before this) only sends a
            // termination signal - it doesn't wait for the process to
            // actually exit, so it can still hold the plaintext file open
            // for a brief moment (Windows won't delete a file that's still
            // open by another process). Retry a few times instead of
            // giving up on the first race: better than leaving the
            // plaintext copy on disk indefinitely, which observed testing
            // confirmed actually happens on a plain single-attempt delete.
            let mut last_err = None;
            for attempt in 0..10 {
                match fs::remove_file(&unlocked.plain_db_path) {
                    Ok(()) => {
                        last_err = None;
                        break;
                    }
                    Err(e) => {
                        last_err = Some(e);
                        if attempt < 9 {
                            std::thread::sleep(Duration::from_millis(100));
                        }
                    }
                }
            }
            if let Some(e) = last_err {
                log::error!("Konnte entschlüsselte Datenbank beim Beenden nicht löschen: {e}");
            }
        }
        Err(e) => log::error!("Konnte Datenbank beim Beenden nicht verschlüsseln: {e}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fast_params() -> KdfParams {
        // Argon2's practical minimum cost, so the unit test suite runs in
        // milliseconds - production uses KdfParams::default() instead.
        KdfParams { mem_kib: 8, time_cost: 1, parallelism: 1 }
    }

    fn random_dek() -> [u8; DEK_LEN] {
        let mut dek = [0u8; DEK_LEN];
        rand::thread_rng().fill_bytes(&mut dek);
        dek
    }

    #[test]
    fn wrap_unwrap_dek_roundtrip_with_correct_secret() {
        let dek = random_dek();
        let params = fast_params();
        let wrapped = wrap_dek(&dek, "correct horse battery staple", &params).unwrap();
        let unwrapped = unwrap_dek(&wrapped, "correct horse battery staple", &params).unwrap();
        assert_eq!(dek, unwrapped);
    }

    #[test]
    fn unwrap_dek_fails_with_wrong_secret() {
        let dek = random_dek();
        let params = fast_params();
        let wrapped = wrap_dek(&dek, "richtiges-passwort", &params).unwrap();
        assert!(unwrap_dek(&wrapped, "falsches-passwort", &params).is_err());
    }

    #[test]
    fn encrypt_decrypt_file_roundtrip() {
        let dir = std::env::temp_dir().join("schuetzenmanager-vault-test-roundtrip");
        fs::create_dir_all(&dir).unwrap();
        let plain_path = dir.join("plain.db");
        let enc_path = dir.join("enc.db");
        fs::write(&plain_path, b"hello sqlite bytes").unwrap();

        let dek = random_dek();
        let nonce = encrypt_file(&dek, &plain_path, &enc_path).unwrap();

        let restored_path = dir.join("restored.db");
        decrypt_file(&dek, &enc_path, &nonce, &restored_path).unwrap();
        assert_eq!(fs::read(&restored_path).unwrap(), b"hello sqlite bytes");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn decrypt_file_fails_with_wrong_dek() {
        let dir = std::env::temp_dir().join("schuetzenmanager-vault-test-wrongdek");
        fs::create_dir_all(&dir).unwrap();
        let plain_path = dir.join("plain.db");
        let enc_path = dir.join("enc.db");
        fs::write(&plain_path, b"secret club data").unwrap();

        let dek = random_dek();
        let nonce = encrypt_file(&dek, &plain_path, &enc_path).unwrap();

        let wrong_dek = random_dek();
        let restored_path = dir.join("restored.db");
        assert!(decrypt_file(&wrong_dek, &enc_path, &nonce, &restored_path).is_err());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn generate_recovery_code_has_expected_format() {
        let code = generate_recovery_code();
        let groups: Vec<&str> = code.split('-').collect();
        assert_eq!(groups.len(), 8);
        for group in &groups {
            assert_eq!(group.len(), 4);
        }
        assert_eq!(code.len(), 8 * 4 + 7); // 32 encoded chars + 7 dashes
        for c in code.chars() {
            assert!(c == '-' || "0123456789ABCDEFGHJKMNPQRSTVWXYZ".contains(c));
        }
        assert!(!code.contains('I') && !code.contains('L') && !code.contains('O') && !code.contains('U'));
    }

    #[test]
    fn recovery_code_and_password_both_unlock_same_dek() {
        let dek = random_dek();
        let params = fast_params();
        let password = "mein-passwort-123";
        let recovery_code = generate_recovery_code();

        let password_wrap = wrap_dek(&dek, password, &params).unwrap();
        let recovery_wrap = wrap_dek(&dek, &recovery_code, &params).unwrap();

        let via_password = unwrap_dek(&password_wrap, password, &params).unwrap();
        let via_recovery = unwrap_dek(&recovery_wrap, &recovery_code, &params).unwrap();

        assert_eq!(dek, via_password);
        assert_eq!(dek, via_recovery);
    }

    // The following two tests exercise vault_change_password's core
    // re-wrap logic directly through wrap_dek/unwrap_dek (mirroring how
    // vault_setup/vault_unlock themselves aren't unit-tested end-to-end,
    // since the #[tauri::command] wrapper needs a real AppHandle).

    #[test]
    fn change_password_rewraps_dek_and_leaves_recovery_code_untouched() {
        let dek = random_dek();
        let params = fast_params();
        let old_password = "altes-passwort-123";
        let recovery_code = generate_recovery_code();

        let old_password_wrap = wrap_dek(&dek, old_password, &params).unwrap();
        let recovery_wrap = wrap_dek(&dek, &recovery_code, &params).unwrap();

        // vault_change_password's core step: unwrap via the old secret,
        // re-wrap the same DEK under the new one.
        let recovered = unwrap_dek(&old_password_wrap, old_password, &params).unwrap();
        assert_eq!(recovered, dek);
        let new_password = "neues-passwort-456";
        let new_password_wrap = wrap_dek(&recovered, new_password, &params).unwrap();

        assert_eq!(unwrap_dek(&new_password_wrap, new_password, &params).unwrap(), dek);
        assert!(unwrap_dek(&new_password_wrap, old_password, &params).is_err());
        // Recovery wrap was never touched - still opens the same DEK.
        assert_eq!(unwrap_dek(&recovery_wrap, &recovery_code, &params).unwrap(), dek);
    }

    #[test]
    fn change_password_rejects_wrong_current_secret() {
        let dek = random_dek();
        let params = fast_params();
        let password_wrap = wrap_dek(&dek, "richtig", &params).unwrap();
        assert!(unwrap_dek(&password_wrap, "falsch", &params).is_err());
    }

    // vault_reset's filesystem core. The #[tauri::command] wrapper itself
    // needs a real AppHandle (to stop the sidecar and clear VaultState), so
    // these drive move_vault_aside directly - the same split the
    // change_password tests above use.

    fn reset_test_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("schuetzenmanager-vault-test-{name}"));
        fs::remove_dir_all(&dir).ok();
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn reset_moves_every_vault_file_into_the_backup_folder() {
        let dir = reset_test_dir("reset-moves");
        for name in VAULT_FILE_NAMES {
            fs::write(dir.join(name), format!("inhalt von {name}")).unwrap();
        }

        let backup = move_vault_aside(&dir, "2026-07-05-120000").unwrap();

        for name in VAULT_FILE_NAMES {
            assert!(!dir.join(name).exists(), "{name} sollte verschoben worden sein");
            assert_eq!(
                fs::read_to_string(backup.join(name)).unwrap(),
                format!("inhalt von {name}"),
                "{name} sollte unverändert in der Sicherung liegen"
            );
        }
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn reset_replaces_an_earlier_backup_so_only_one_generation_remains() {
        let dir = reset_test_dir("reset-one-generation");
        let stale = dir.join(format!("{RESET_BACKUP_PREFIX}2020-01-01-000000"));
        fs::create_dir_all(&stale).unwrap();
        fs::write(stale.join("vault.json"), "alte sicherung").unwrap();
        fs::write(dir.join("vault.json"), "aktueller tresor").unwrap();

        let backup = move_vault_aside(&dir, "2026-07-05-120000").unwrap();

        assert!(!stale.exists(), "die ältere Sicherung sollte entfernt sein");
        let backups: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with(RESET_BACKUP_PREFIX))
            .collect();
        assert_eq!(backups.len(), 1);
        assert_eq!(fs::read_to_string(backup.join("vault.json")).unwrap(), "aktueller tresor");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn reset_without_an_existing_vault_is_a_harmless_no_op() {
        let dir = reset_test_dir("reset-empty");
        let backup = move_vault_aside(&dir, "2026-07-05-120000").unwrap();
        assert!(backup.exists(), "der Sicherungsordner wird auch dann angelegt");
        assert_eq!(fs::read_dir(&backup).unwrap().count(), 0);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn reset_skips_files_that_are_absent() {
        // A vault that was never unlocked has no .bak files and no
        // plaintext database.db - only the two primary files exist.
        let dir = reset_test_dir("reset-partial");
        fs::write(dir.join("vault.json"), "meta").unwrap();
        fs::write(dir.join("database.db.enc"), "cipher").unwrap();

        let backup = move_vault_aside(&dir, "2026-07-05-120000").unwrap();

        assert_eq!(fs::read_to_string(backup.join("vault.json")).unwrap(), "meta");
        assert_eq!(fs::read_to_string(backup.join("database.db.enc")).unwrap(), "cipher");
        assert!(!backup.join("vault.json.bak").exists());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn format_timestamp_renders_a_sortable_utc_stamp() {
        // 2026-07-05T12:34:56Z as seconds since the epoch.
        let stamp = format_timestamp(UNIX_EPOCH + Duration::from_secs(1_783_254_896));
        assert_eq!(stamp, "2026-07-05-123456");
        // The epoch itself, and a leap day, to pin the date maths down.
        assert_eq!(format_timestamp(UNIX_EPOCH), "1970-01-01-000000");
        assert_eq!(
            format_timestamp(UNIX_EPOCH + Duration::from_secs(1_709_164_800)),
            "2024-02-29-000000"
        );
    }
}
