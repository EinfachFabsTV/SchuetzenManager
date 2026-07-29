import { buildApp } from "./app.js";
import { runStartupMigrations } from "./migrate.js";

// Bring an existing/restored local database up to the current schema before
// serving (no-op for postgresql / central hosting).
runStartupMigrations({ info: (m) => console.log(m), error: (m) => console.error(m) });

const app = await buildApp();

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
