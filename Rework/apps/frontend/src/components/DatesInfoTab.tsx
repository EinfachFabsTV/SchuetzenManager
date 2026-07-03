import { useState } from "react";
import { api } from "../api/client";
import type { SeasonDetail } from "../types";
import { theme } from "../theme";

const inputStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  fontSize: 13,
  background: theme.surfaceAlt,
  color: theme.text,
};

const saveButton: React.CSSProperties = {
  border: "none",
  background: theme.green,
  color: theme.onAccent,
  borderRadius: 6,
  padding: "8px 16px",
  cursor: "pointer",
  fontSize: 13,
};

// Mirrors the Legacy "Termine Wettkampfwochen" (WeekToDate) and "PDF
// Einstellungen" (EditDateInfo) dialogs, combined into one tab.
export function DatesInfoTab({ season, onUpdated }: { season: SeasonDetail; onUpdated: () => void }) {
  const [dates, setDates] = useState<Record<number, string>>(
    Object.fromEntries(season.matchDates.map((d) => [d.week, d.date ?? ""])),
  );
  const [infoBox, setInfoBox] = useState(season.infoBox ?? "");
  const [contactPerson, setContactPerson] = useState(season.contactPerson ?? "");
  const [contactMail, setContactMail] = useState(season.contactMail ?? "");
  const [datesMsg, setDatesMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [savingDates, setSavingDates] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  const weeks = [...season.matchDates].sort((a, b) => a.week - b.week);

  async function saveDates() {
    setDatesMsg(null);
    setSavingDates(true);
    try {
      await api.updateDates(
        season.id,
        weeks.map((w) => ({ week: w.week, date: dates[w.week] || null })),
      );
      setDatesMsg("Termine gespeichert.");
      onUpdated();
    } catch (err) {
      setDatesMsg((err as Error).message);
    } finally {
      setSavingDates(false);
    }
  }

  async function saveInfo() {
    setInfoMsg(null);
    setSavingInfo(true);
    try {
      await api.updateSeasonInfo(season.id, { infoBox, contactPerson, contactMail });
      setInfoMsg("Angaben gespeichert.");
      onUpdated();
    } catch (err) {
      setInfoMsg((err as Error).message);
    } finally {
      setSavingInfo(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 560 }}>
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Termine der Wettkampfwochen</h2>
        {weeks.length === 0 && <p style={{ fontSize: 13, color: theme.textMuted }}>Keine Wochen vorhanden.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {weeks.map((w) => (
            <label key={w.week} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ width: 90, color: theme.textMuted }}>Woche {w.week}</span>
              <input
                type="date"
                value={dates[w.week] ?? ""}
                onChange={(e) => setDates((prev) => ({ ...prev, [w.week]: e.target.value }))}
                style={{ ...inputStyle, width: 170 }}
              />
            </label>
          ))}
        </div>
        {datesMsg && <p style={{ fontSize: 13, color: theme.green, marginTop: 10 }}>{datesMsg}</p>}
        <button type="button" onClick={saveDates} disabled={savingDates} style={{ ...saveButton, marginTop: 12 }}>
          {savingDates ? "Speichert…" : "Termine speichern"}
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Angaben fürs PDF</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: theme.textMuted }}>
            Ansprechpartner
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: theme.textMuted }}>
            Kontakt-E-Mail
            <input value={contactMail} onChange={(e) => setContactMail(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: theme.textMuted }}>
            Infotext
            <textarea
              value={infoBox}
              onChange={(e) => setInfoBox(e.target.value)}
              rows={4}
              style={{ ...inputStyle, height: "auto", padding: 10, width: "100%", resize: "vertical", fontFamily: "inherit" }}
            />
          </label>
        </div>
        {infoMsg && <p style={{ fontSize: 13, color: theme.green, marginTop: 10 }}>{infoMsg}</p>}
        <button type="button" onClick={saveInfo} disabled={savingInfo} style={{ ...saveButton, marginTop: 12 }}>
          {savingInfo ? "Speichert…" : "Angaben speichern"}
        </button>
      </section>
    </div>
  );
}
