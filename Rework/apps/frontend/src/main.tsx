import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { VaultGate } from "./components/VaultGate";

// VaultGate wraps App here rather than inside App's own JSX, because App
// fires an unconditional GET /seasons in its own effect on mount - if the
// gate only wrapped App's *return value*, that request would still race
// ahead of the vault being unlocked and the sidecar being started. Not
// mounting App at all until unlocked avoids that entirely.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <VaultGate>
      <App />
    </VaultGate>
  </React.StrictMode>,
);
