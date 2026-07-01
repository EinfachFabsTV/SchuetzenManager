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
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>SchützenManager</h1>
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
