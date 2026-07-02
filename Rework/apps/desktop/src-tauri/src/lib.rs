mod vault;

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

pub(crate) struct SidecarState(pub(crate) Mutex<Option<CommandChild>>);

// Resolves the resources/backend directory bundled next to the running
// executable.
//
// app.path().resource_dir() resolved to a bogus path ("C:") when testing
// an unpackaged `cargo build` output (no bundle metadata to resolve
// against). Resources land next to the executable in every Tauri build
// mode that was actually tested (`cargo tauri build`), so resolving
// relative to the running exe's own path is more reliable here than
// relying on resource_dir()'s bundle detection.
pub(crate) fn resolve_backend_dir() -> Result<PathBuf, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("current_exe() failed: {e}"))?
        .parent()
        .ok_or("executable has no parent directory")?
        .to_path_buf();
    Ok(exe_dir.join("resources").join("backend"))
}

pub(crate) fn resolve_template_db() -> Result<PathBuf, String> {
    Ok(resolve_backend_dir()?.join("prisma").join("template.db"))
}

// Starts the Fastify backend bundled under resources/backend (see
// Rework/apps/desktop/scripts/prepare-sidecar.mjs) as a child process
// against an already-resolved, already-decrypted SQLite database path.
// This function itself no longer knows or cares about encryption - the
// vault (see vault.rs) is set up/unlocked before this is ever called, so
// by the time it runs, `db_path` always points at a plaintext file.
fn start_backend_sidecar(app: &tauri::AppHandle, db_path: &Path) -> Result<CommandChild, String> {
    let backend_dir = resolve_backend_dir()?;
    let server_js = backend_dir.join("dist").join("server.js");

    let database_url = format!("file:{}", db_path.display().to_string().replace('\\', "/"));

    let (mut rx, child) = app
        .shell()
        .sidecar("node")
        .map_err(|e| format!("sidecar lookup failed: {e}"))?
        .args([server_js.display().to_string()])
        .env("DATABASE_URL", database_url)
        .env("PORT", "3001")
        .spawn()
        .map_err(|e| format!("failed to spawn backend sidecar: {e}"))?;

    // Drain the sidecar's stdout/stderr into the app log instead of
    // discarding it - both for diagnostics and to avoid the child
    // blocking on a full, never-read output pipe.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    log::info!("[backend] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    log::error!("[backend] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => {
                    log::error!("[backend] sidecar error: {err}");
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!("[backend] sidecar exited: {:?}", payload);
                }
                _ => {}
            }
        }
    });

    Ok(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(Mutex::new(None)))
        .manage(vault::VaultState::new())
        .invoke_handler(tauri::generate_handler![
            vault::vault_status,
            vault::vault_setup,
            vault::vault_unlock
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .targets([
                            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                                file_name: None,
                            }),
                        ])
                        .build(),
                )?;
            }

            // The backend sidecar is no longer started unconditionally
            // here - it needs an already-decrypted plaintext database to
            // point at, so it only starts once the frontend's VaultGate
            // has completed vault_setup or vault_unlock (see vault.rs).
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                let sidecar_state = app_handle.state::<SidecarState>();
                let mut guard = sidecar_state.0.lock().unwrap();
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                }
                drop(guard);

                vault::reencrypt_on_exit(&app_handle.state::<vault::VaultState>());
            }
        });
}
