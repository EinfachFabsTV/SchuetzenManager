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
use std::time::{Duration, Instant};

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

    let child = crate::start_backend_sidecar(&app, &paths.plain_db)?;
    app.state::<crate::SidecarState>().0.lock().unwrap().replace(child);
    wait_for_port(BACKEND_PORT, Duration::from_secs(5))?;

    app.state::<VaultState>().0.lock().unwrap().replace(VaultUnlocked {
        dek,
        plain_db_path: paths.plain_db,
        enc_db_path: paths.enc_db,
        vault_json_path: paths.vault_json,
    });

    Ok(recovery_code)
}

#[tauri::command]
pub fn vault_unlock(app: tauri::AppHandle, secret: String) -> Result<(), String> {
    let paths = resolve_vault_paths(&app)?;
    if !paths.vault_json.exists() {
        return Err("Kein Tresor eingerichtet.".to_string());
    }
    let meta_json = fs::read_to_string(&paths.vault_json).map_err(|e| format!("could not read vault metadata: {e}"))?;
    let meta: VaultMeta = serde_json::from_str(&meta_json).map_err(|e| format!("could not parse vault metadata: {e}"))?;

    let wrong_secret_err = || "Falsches Passwort oder falscher Wiederherstellungscode.".to_string();

    let dek = if paths.plain_db.exists() {
        // The app was previously killed rather than closed cleanly: the
        // leftover plaintext copy reflects writes made during that crashed
        // session and is therefore *newer* than database.db.enc (which
        // was last written on the previous *clean* exit). Trust it
        // instead of overwriting it with the stale ciphertext - we still
        // need to recover the DEK (to re-encrypt correctly on the next
        // clean exit), but skip decrypt_file entirely.
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

    let child = crate::start_backend_sidecar(&app, &paths.plain_db)?;
    app.state::<crate::SidecarState>().0.lock().unwrap().replace(child);
    wait_for_port(BACKEND_PORT, Duration::from_secs(5))?;

    app.state::<VaultState>().0.lock().unwrap().replace(VaultUnlocked {
        dek,
        plain_db_path: paths.plain_db,
        enc_db_path: paths.enc_db,
        vault_json_path: paths.vault_json,
    });

    Ok(())
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
            if let Err(e) = fs::remove_file(&unlocked.plain_db_path) {
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
}
