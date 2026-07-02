import { useEffect, useState } from "react";
import { theme } from "../theme";

const RING_CIRCUMFERENCE = 2 * Math.PI * 70;
const TOTAL_MS = 5000;

// Timeline (ms from mount):
//   0    - rifle slides in, outer target ring starts drawing
//   700  - middle/inner rings draw, wordmark fades in
//   1500 - rifle recoils + muzzle flash
//   1750 - bullet travels toward the logo
//   2250 - impact: flash + shockwave cracks + logo shake
//   4500 - whole overlay fades out
//   5000 - onFinish() unmounts this component
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), TOTAL_MS - 500);
    const doneTimer = setTimeout(onFinish, TOTAL_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: theme.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 500ms ease",
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes sm-draw-ring { from { stroke-dashoffset: var(--sm-circ); } to { stroke-dashoffset: 0; } }
        @keyframes sm-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sm-rifle-in { from { transform: translateX(-140px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes sm-recoil { 0%, 100% { transform: translateX(0) rotate(0deg); } 50% { transform: translateX(-10px) rotate(-2deg); } }
        @keyframes sm-muzzle-flash { 0%, 100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes sm-bullet { from { transform: translateX(0); opacity: 1; } 92% { opacity: 1; } to { transform: translateX(250px); opacity: 0; } }
        @keyframes sm-impact-flash { 0% { opacity: 0; transform: scale(0.2); } 25% { opacity: 1; transform: scale(1.7); } 100% { opacity: 0; transform: scale(2.4); } }
        @keyframes sm-shake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-5px, 3px); } 40% { transform: translate(5px, -3px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(4px, -2px); } }
        @keyframes sm-crack { 0% { opacity: 0; } 8% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>

      <svg width="700" height="280" viewBox="0 0 800 320" role="img" aria-label="SchützenManager startet">
        <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "sm-rifle-in 500ms ease-out both" }}>
          <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "sm-recoil 300ms ease-out 1500ms both" }}>
            <rect x="40" y="142" width="150" height="14" rx="4" fill="#3a3c33" />
            <rect x="50" y="156" width="30" height="26" rx="3" fill="#3a3c33" />
            <rect x="185" y="146" width="70" height="7" rx="3" fill="#4a4c45" />
            <rect x="95" y="132" width="16" height="14" rx="2" fill="#4a4c45" />
          </g>
          <polygon
            points="260,149 280,149.5 262,143 275,150 262,157 280,150.5"
            fill={theme.gold}
            style={{ transformBox: "fill-box", transformOrigin: "left center", animation: "sm-muzzle-flash 300ms ease-out 1500ms both" }}
          />
          <circle
            cx="266"
            cy="150"
            r="4.5"
            fill={theme.gold}
            style={{ animation: "sm-bullet 500ms linear 1750ms both" }}
          />
        </g>

        <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "sm-shake 400ms ease-out 2250ms both" }}>
          <circle
            cx="520"
            cy="150"
            r="70"
            fill="none"
            stroke="#F4F1E8"
            strokeWidth="12"
            strokeDasharray={RING_CIRCUMFERENCE}
            style={{ animation: "sm-draw-ring 900ms ease-out 100ms both", ["--sm-circ" as string]: RING_CIRCUMFERENCE }}
          />
          <circle
            cx="520"
            cy="150"
            r="48"
            fill="none"
            stroke="#F4F1E8"
            strokeWidth="12"
            strokeDasharray={2 * Math.PI * 48}
            style={{ animation: `sm-draw-ring 700ms ease-out 700ms both`, ["--sm-circ" as string]: 2 * Math.PI * 48 }}
          />
          <circle
            cx="520"
            cy="150"
            r="26"
            fill="none"
            stroke={theme.gold}
            strokeWidth="12"
            strokeDasharray={2 * Math.PI * 26}
            style={{ animation: `sm-draw-ring 500ms ease-out 1200ms both`, ["--sm-circ" as string]: 2 * Math.PI * 26 }}
          />
          <circle cx="520" cy="150" r="7" fill={theme.gold} style={{ opacity: 0, animation: "sm-fade-in 200ms ease-out 1600ms both" }} />

          <circle
            cx="520"
            cy="150"
            r="90"
            fill="none"
            stroke={theme.gold}
            strokeWidth="3"
            style={{ opacity: 0, animation: "sm-impact-flash 500ms ease-out 2250ms both" }}
          />
          {[0, 45, 100, 145, 200, 260, 300].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 520 + Math.cos(rad) * 30;
            const y1 = 150 + Math.sin(rad) * 30;
            const x2 = 520 + Math.cos(rad) * 78;
            const y2 = 150 + Math.sin(rad) * 78;
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#F4F1E8"
                strokeWidth="2"
                style={{ opacity: 0, animation: "sm-crack 1200ms ease-out 2250ms both" }}
              />
            );
          })}
        </g>

        <text
          x="520"
          y="270"
          textAnchor="middle"
          fontSize="30"
          fontWeight={600}
          fill={theme.text}
          fontFamily="system-ui, sans-serif"
          style={{ opacity: 0, animation: "sm-fade-in 500ms ease-out 700ms both" }}
        >
          Schützen<tspan fill={theme.gold}>Manager</tspan>
        </text>
      </svg>
    </div>
  );
}
