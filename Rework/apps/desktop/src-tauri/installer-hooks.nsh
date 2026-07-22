; Tauri NSIS installer hooks.
;
; Two jobs: stop everything that would block file writes, and give the user
; a say over existing data when they run the installer by hand.
;
; THE RULE THAT MUST NOT BE BROKEN: every prompt in this file is guarded by
; IfSilent. tauri-plugin-updater runs the setup silently during an
; auto-update, AND that setup silently runs the previous version's
; uninstaller. An unguarded prompt would either hang the update behind an
; invisible dialog or - far worse - ask about deleting data during the
; uninstall step and act on it. Silent always means "keep the data".

!include "FileFunc.nsh"
!include "LogicLib.nsh"

; Must match resolve_vault_paths() in src/vault.rs (app_data_dir is
; %APPDATA%\<bundle identifier>) and RESET_BACKUP_PREFIX / VAULT_FILE_NAMES
; in the same file - a reset done here has to look exactly like one done
; from inside the app.
!define SM_DATA_DIR "$APPDATA\de.schuetzenmanager.desktop"
!define SM_BACKUP_PREFIX "reset-backup-"

; Stops anything holding files open. The sidecar keeps the Prisma query
; engine DLL loaded, which is what made installs fail with "Error opening
; file for writing" and left uninstalls half-done. The installer already
; closes the main window, but not its child process.
;
; Every call is best-effort: on a first install there is nothing to stop,
; and a failure here must never abort the installation.
!macro SM_STOP_PROCESSES
  nsExec::Exec 'taskkill /F /T /IM schuetzenmanager-backend.exe'
  Pop $0
  nsExec::Exec 'taskkill /F /T /IM "SchützenManager.exe"'
  Pop $0
  ; Installations from v0.1.0-v0.1.2 ran the sidecar as a plain node.exe.
  ; Filtered by executable path so only the copy inside our own install
  ; directory is touched - the user's unrelated Node applications are not.
  nsExec::Exec "powershell -NoProfile -ExecutionPolicy Bypass -Command $\"Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like '$INSTDIR\*' } | Stop-Process -Force$\""
  Pop $0
!macroend

; Moves the vault aside into a fresh timestamped folder, mirroring
; move_vault_aside() in src/vault.rs. The installer cannot call that code -
; it runs before the app exists, and depending on a possibly broken
; installation would defeat the point of having this here at all.
!macro SM_BACKUP_VAULT
  ; Only one generation is kept, same as the in-app reset.
  FindFirst $R9 $R8 "${SM_DATA_DIR}\${SM_BACKUP_PREFIX}*"
  ${Do}
    ${If} $R8 == ""
      ${ExitDo}
    ${EndIf}
    RMDir /r "${SM_DATA_DIR}\$R8"
    FindNext $R9 $R8
  ${Loop}
  FindClose $R9

  ; $R2=year $R1=month $R0=day $R4=hour $R5=minute $R6=second
  ${GetTime} "" "L" $R0 $R1 $R2 $R3 $R4 $R5 $R6
  StrCpy $R7 "${SM_DATA_DIR}\${SM_BACKUP_PREFIX}$R2-$R1-$R0-$R4$R5$R6"
  CreateDirectory "$R7"

  Rename "${SM_DATA_DIR}\database.db.enc" "$R7\database.db.enc"
  Rename "${SM_DATA_DIR}\vault.json" "$R7\vault.json"
  Rename "${SM_DATA_DIR}\database.db.enc.bak" "$R7\database.db.enc.bak"
  Rename "${SM_DATA_DIR}\vault.json.bak" "$R7\vault.json.bak"
  Rename "${SM_DATA_DIR}\database.db" "$R7\database.db"
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro SM_STOP_PROCESSES

  ; Silent means an auto-update: never prompt, never touch the data.
  IfSilent sm_preinstall_done

  ${If} ${FileExists} "${SM_DATA_DIR}\vault.json"
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON1 \
      "Es sind bereits Daten von SchützenManager vorhanden.$\n$\nSollen die vorhandenen Saisondaten behalten werden?$\n$\nJa = behalten (empfohlen)$\nNein = zurücksetzen und neu beginnen. Die alten Daten werden dabei nicht gelöscht, sondern verschlüsselt in einen Sicherungsordner verschoben." \
      IDYES sm_preinstall_done
    !insertmacro SM_BACKUP_VAULT
  ${EndIf}

  sm_preinstall_done:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro SM_STOP_PROCESSES

  ; Silent here is the update path running the OLD uninstaller. Prompting
  ; would be catastrophic: it could delete the user's data mid-update.
  IfSilent sm_preuninstall_done

  ${If} ${FileExists} "${SM_DATA_DIR}\vault.json"
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
      "Sollen auch die gespeicherten Saisondaten entfernt werden?$\n$\nNein = Daten behalten (empfohlen). Bei einer erneuten Installation stehen sie wieder zur Verfügung.$\nJa = alle Daten unwiderruflich löschen." \
      IDNO sm_preuninstall_done
    RMDir /r "${SM_DATA_DIR}"
  ${EndIf}

  sm_preuninstall_done:
!macroend
