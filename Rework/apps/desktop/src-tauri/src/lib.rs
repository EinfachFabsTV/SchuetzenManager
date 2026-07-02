use std::fs;
use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct SidecarState(Mutex<Option<CommandChild>>);

// Starts the Fastify backend bundled under resources/backend (see
// Rework/apps/desktop/scripts/prepare-sidecar.mjs) as a child process,
// using a per-user SQLite database instead of writing into the
// (read-only, once installed) app resource directory. See TECHNICAL.md's
// "Tauri-Sidecar" section for the full rationale.
fn start_backend_sidecar(app: &tauri::AppHandle) -> Result<CommandChild, String> {
    // app.path().resource_dir() resolved to a bogus path ("C:") when
    // testing an unpackaged `cargo build` output (no bundle metadata to
    // resolve against). Resources land next to the executable in every
    // Tauri build mode that was actually tested (`cargo tauri build`),
    // so resolving relative to the running exe's own path is more
    // reliable here than relying on resource_dir()'s bundle detection.
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("current_exe() failed: {e}"))?
        .parent()
        .ok_or("executable has no parent directory")?
        .to_path_buf();
    let backend_dir = exe_dir.join("resources").join("backend");
    let server_js = backend_dir.join("dist").join("server.js");
    let template_db = backend_dir.join("prisma").join("template.db");

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir() failed: {e}"))?;
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("could not create app data dir: {e}"))?;
    let db_path = app_data_dir.join("database.db");
    if !db_path.exists() {
        fs::copy(&template_db, &db_path)
            .map_err(|e| format!("could not seed database from template: {e}"))?;
    }

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

            match start_backend_sidecar(app.handle()) {
                Ok(child) => {
                    let state = app.state::<SidecarState>();
                    *state.0.lock().unwrap() = Some(child);
                }
                Err(err) => {
                    log::error!("Backend-Sidecar konnte nicht gestartet werden: {err}");
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                let state = app_handle.state::<SidecarState>();
                let mut guard = state.0.lock().unwrap();
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                }
            }
        });
}
