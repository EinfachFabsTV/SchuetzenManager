import { useEffect, useState } from "react";

type Season = {
  id: number;
  year: number;
  label: string;
};

export default function App() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/seasons")
      .then((res) => {
        if (!res.ok) throw new Error(`API antwortete mit ${res.status}`);
        return res.json();
      })
      .then(setSeasons)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        padding: "2rem",
        background: "#fff",
        color: "#1a1a1a",
        minHeight: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
        <img src="/logo.svg" alt="SchützenManager Logo" width={40} height={40} />
        <h1 style={{ margin: 0 }}>SchützenManager</h1>
      </div>
      {error && <p style={{ color: "crimson" }}>Backend nicht erreichbar: {error}</p>}
      {!error && seasons.length === 0 && <p>Keine Saisons vorhanden.</p>}
      <ul>
        {seasons.map((season) => (
          <li key={season.id}>
            {season.label} ({season.year})
          </li>
        ))}
      </ul>
    </main>
  );
}
