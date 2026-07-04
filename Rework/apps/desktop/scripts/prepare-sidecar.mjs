// Prepares everything the Tauri desktop build needs to run the backend
// as a sidecar process (see TECHNICAL.md's "Tauri-Sidecar" section):
//   1. builds the backend (tsc -> dist/, unchanged ESM output)
//   2. installs a production-only copy of its node_modules into
//      src-tauri/resources/backend (esbuild bundling was tried first and
//      abandoned - fastify's dependency graph relies on dynamic
//      `require()` calls esbuild's ESM output can't statically rewrite,
//      and CJS output can't support server.ts's top-level awaits)
//   3. copies the Prisma schema/migrations and generates a fresh,
//      already-migrated template.db so the app doesn't need the Prisma
//      CLI at runtime just to set up a new user's database
//   4. copies the current Node executable into src-tauri/binaries/ under
//      Tauri's sidecar naming convention, since Tauri sidecars must be a
//      literal external binary, not a script

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, cpSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(desktopDir, "../backend");
const resourcesDir = path.join(desktopDir, "src-tauri", "resources", "backend");
const binariesDir = path.join(desktopDir, "src-tauri", "binaries");

// Maps the running platform to the Rust target triple Tauri expects the
// sidecar binary to be suffixed with. Only the combinations this project
// actually builds for (see .github/workflows/release.yml's matrix) are
// listed; extend this if more targets are added.
const TARGET_TRIPLES = {
  "win32-x64": "x86_64-pc-windows-msvc",
  "linux-x64": "x86_64-unknown-linux-gnu",
  "darwin-x64": "x86_64-apple-darwin",
  "darwin-arm64": "aarch64-apple-darwin",
};
const platformKey = `${process.platform}-${process.arch}`;
const TARGET_TRIPLE = TARGET_TRIPLES[platformKey];
if (!TARGET_TRIPLE) {
  throw new Error(`No known Rust target triple for platform "${platformKey}" - add it to TARGET_TRIPLES.`);
}

function run(cmd, cwd) {
  console.log(`> ${cmd} (cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

console.log("== 1/4: building backend ==");
run("npm run build", backendDir);

console.log("== 2/4: staging production node_modules ==");
rmSync(resourcesDir, { recursive: true, force: true });
mkdirSync(resourcesDir, { recursive: true });
cpSync(path.join(backendDir, "dist"), path.join(resourcesDir, "dist"), { recursive: true });

const backendPkg = JSON.parse(readFileSync(path.join(backendDir, "package.json"), "utf8"));
const stagingPkg = {
  name: "schuetzenmanager-backend-sidecar",
  private: true,
  type: "module",
  dependencies: backendPkg.dependencies,
};
writeFileSync(path.join(resourcesDir, "package.json"), JSON.stringify(stagingPkg, null, 2));
run("npm install --omit=dev --no-audit --no-fund", resourcesDir);

// `npm install` only pulls the generic, un-generated @prisma/client
// package - the actual generated client code + native query engine
// binary for our schema lives in the workspace root's
// node_modules/.prisma/client (written there by `prisma generate`,
// see apps/backend's npm scripts). Copy that over the placeholder.
const workspaceRoot = path.resolve(desktopDir, "..", "..");
const generatedClientSrc = path.join(workspaceRoot, "node_modules", ".prisma", "client");
if (!existsSync(generatedClientSrc)) {
  throw new Error(`Generated Prisma client not found at ${generatedClientSrc} - run "npm run prisma:generate --workspace apps/backend" first.`);
}
rmSync(path.join(resourcesDir, "node_modules", ".prisma", "client"), { recursive: true, force: true });
cpSync(generatedClientSrc, path.join(resourcesDir, "node_modules", ".prisma", "client"), { recursive: true });

console.log("== 3/4: Prisma schema/migrations + template database ==");
const prismaDest = path.join(resourcesDir, "prisma");
mkdirSync(prismaDest, { recursive: true });
cpSync(path.join(backendDir, "prisma", "schema.prisma"), path.join(prismaDest, "schema.prisma"));
cpSync(path.join(backendDir, "prisma", "migrations"), path.join(prismaDest, "migrations"), { recursive: true });

const templateDbPath = path.join(prismaDest, "template.db");
rmSync(templateDbPath, { force: true });
execSync("npx prisma migrate deploy", {
  cwd: backendDir,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `file:${templateDbPath}` },
});

console.log("== 4/4: bundling the Node runtime as the sidecar binary ==");
mkdirSync(binariesDir, { recursive: true });
const exeSuffix = process.platform === "win32" ? ".exe" : "";
// Named schuetzenmanager-backend (not the generic "node") so the running
// sidecar process is uniquely identifiable: it never collides with the
// user's own node.exe, and the NSIS installer can close exactly this
// process before overwriting its files (the Prisma engine DLL is loaded by
// it - see installer-hooks.nsh).
const sidecarDest = path.join(binariesDir, `schuetzenmanager-backend-${TARGET_TRIPLE}${exeSuffix}`);
copyFileSync(process.execPath, sidecarDest);
if (process.platform !== "win32") {
  execSync(`chmod +x "${sidecarDest}"`);
}

console.log(`\nDone. Sidecar resources in ${resourcesDir}`);
console.log(`Sidecar binary: ${sidecarDest}`);
