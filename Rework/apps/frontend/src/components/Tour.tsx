import { useEffect, useState } from "react";
import type { TourStep } from "../lib/tour";
import { theme } from "../theme";

// Renders a guided tour over the app: dims the background, highlights the
// current step's target element (if it's in the DOM) and shows a tooltip with
// Weiter/Fertig. Non-skippable by design - there's no skip control, only
// stepping through. A step whose target isn't found simply shows a centered
// card instead of blocking.
export function Tour({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];

  useEffect(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "auto" });
      setRect(el.getBoundingClientRect());
    } else {
      // Target not mounted (e.g. a section that isn't open) - fall back to a
      // centered card rather than pointing at nothing.
      setRect(null);
    }
  }, [step]);

  if (!step) return null;

  const isLast = index === steps.length - 1;
  function next() {
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  }

  // Tooltip position: below the highlighted element when there's room, else
  // centered. Kept simple and clamped to the viewport.
  const pad = 8;
  const tooltipWidth = 320;
  let tooltipStyle: React.CSSProperties;
  if (rect) {
    const top = rect.bottom + 12;
    const left = Math.min(Math.max(rect.left, 12), window.innerWidth - tooltipWidth - 12);
    tooltipStyle = { top: top + window.scrollY, left };
  } else {
    tooltipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000 }} role="dialog" aria-modal="true" aria-label="Programm-Tour">
      {/* Dim layer. With a highlight, a bright ring marks the target. */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      {rect && (
        <div
          style={{
            position: "absolute",
            top: rect.top - pad + window.scrollY,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            border: `2px solid ${theme.green}`,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          width: tooltipWidth,
          maxWidth: "calc(100vw - 24px)",
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 18,
          color: theme.text,
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          ...tooltipStyle,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>{step.title}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 16px", color: theme.textMuted }}>{step.body}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: theme.textMuted }}>
            Schritt {index + 1} von {steps.length}
          </span>
          <button
            type="button"
            onClick={next}
            style={{ border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            {isLast ? "Fertig" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
