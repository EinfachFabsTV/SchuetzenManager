import { useId, useRef, useState } from "react";
import { filterShooters, formatShooter, type KnownShooter } from "../lib/shooterSuggestions";
import { theme } from "../theme";

/**
 * Namensfeld mit Vorschlägen aus bereits erfassten Schützen. Schlägt nur vor -
 * übernommen wird erst per Klick, Tab oder Enter, getippt werden kann wie
 * bisher frei weiter.
 */
export function ShooterNameInput({
  value,
  onChange,
  onPick,
  known,
  style,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Übernimmt Vor- und Nachnamen des gewählten Schützen. */
  onPick: (shooter: KnownShooter) => void;
  known: KnownShooter[];
  style: React.CSSProperties;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const blurTimer = useRef<number | undefined>(undefined);

  const matches = open ? filterShooters(known, value) : [];
  const visible = matches.length > 0;

  function pick(shooter: KnownShooter) {
    onPick(shooter);
    setOpen(false);
    setActive(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!visible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      // Tab übernimmt den markierten Vorschlag und springt danach wie
      // gewohnt weiter - deshalb hier kein preventDefault bei Tab.
      if (e.key === "Enter") e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        style={{ ...style, width: "100%", boxSizing: "border-box" }}
        value={value}
        aria-label={label}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        // Der Klick auf einen Vorschlag löst zuerst blur aus; ohne die kurze
        // Verzögerung wäre die Liste beim Klick schon zu.
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 2px)",
            left: 0,
            minWidth: "100%",
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
            maxHeight: 190,
            overflowY: "auto",
          }}
        >
          {matches.map((s, i) => (
            <li
              key={`${s.lastName}|${s.firstName}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              // mousedown kommt vor blur - hier wird das Zuklappen abgeräumt,
              // damit der Klick den Vorschlag noch erreicht.
              onMouseDown={() => window.clearTimeout(blurTimer.current)}
              onClick={() => pick(s)}
              style={{
                padding: "5px 8px",
                borderRadius: 4,
                background: i === active ? theme.greenLight : "transparent",
                color: theme.text,
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {formatShooter(s)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
