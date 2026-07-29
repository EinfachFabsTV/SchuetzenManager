import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

// Global PDF-header settings live in a single Settings row (id = 1). The logo
// is stored as bytes in the DB, not as a filesystem path, so it survives the
// user deleting the folder they picked the image from - the core requirement.
const SETTINGS_ID = 1;

// Guards the base64 logo upload. 1 MB is plenty for a header logo and keeps
// the DB row (and every PDF that embeds it) from bloating.
const MAX_LOGO_BYTES = 1024 * 1024;

// Accepts a data URL ("data:image/png;base64,....") or a bare base64 string.
export function decodeLogo(input: string): Buffer {
  const comma = input.indexOf(",");
  const base64 = input.startsWith("data:") && comma !== -1 ? input.slice(comma + 1) : input;
  return Buffer.from(base64, "base64");
}

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  // Text fields + whether a logo is present. The logo bytes themselves are
  // served separately (GET /settings/logo) so JSON responses stay small.
  app.get("/settings", async () => {
    const s = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
    return {
      headerLine1: s?.headerLine1 ?? null,
      headerLine2: s?.headerLine2 ?? null,
      hasLogo: !!s?.logo,
    };
  });

  app.get("/settings/logo", async (_request, reply) => {
    const s = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
    if (!s?.logo) {
      reply.code(404);
      return { error: "Kein Logo hinterlegt." };
    }
    reply.header("Content-Type", "image/*");
    return reply.send(Buffer.from(s.logo));
  });

  // Partial update. `logo` is base64 to set, null to clear, omitted to keep.
  app.put<{ Body: { headerLine1?: string | null; headerLine2?: string | null; logo?: string | null } }>(
    "/settings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { headerLine1, headerLine2, logo } = request.body;
      let logoBytes: Buffer | null | undefined;
      if (logo !== undefined) {
        if (logo === null) {
          logoBytes = null;
        } else {
          logoBytes = decodeLogo(logo);
          if (logoBytes.length === 0) {
            reply.code(400);
            return { error: "Das Logo konnte nicht gelesen werden." };
          }
          if (logoBytes.length > MAX_LOGO_BYTES) {
            reply.code(400);
            return { error: "Das Logo ist zu groß (max. 1 MB)." };
          }
        }
      }
      const data = {
        ...(headerLine1 !== undefined ? { headerLine1 } : {}),
        ...(headerLine2 !== undefined ? { headerLine2 } : {}),
        ...(logoBytes !== undefined ? { logo: logoBytes } : {}),
      };
      const s = await prisma.settings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, ...data },
        update: data,
      });
      return { headerLine1: s.headerLine1, headerLine2: s.headerLine2, hasLogo: !!s.logo };
    },
  );
};
