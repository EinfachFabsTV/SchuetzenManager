; Tauri NSIS installer hooks.
;
; Before writing any files, stop the running backend sidecar
; (schuetzenmanager-backend.exe). It keeps the Prisma query-engine DLL
; loaded, so if it is still running when the installer/updater tries to
; overwrite resources\backend\..., the install fails with
; "Error opening file for writing". The installer already closes the main
; app; this closes its child sidecar too. Uniquely named, so no unrelated
; node.exe is touched. /T also ends any child processes; errors are ignored
; (nothing to kill on a first install).
!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /T /IM schuetzenmanager-backend.exe'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /T /IM schuetzenmanager-backend.exe'
!macroend
