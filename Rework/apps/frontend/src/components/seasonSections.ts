import type { AuthUser } from "../api/client";

// The per-season sections shown as a sidebar sub-navigation under the
// selected season. Shared between App/Sidebar (nav) and SeasonView
// (content). "Verantwortliche" only applies to central hosting (webservice
// users), so it's offered only when a user is logged in.
export function seasonSections(user: AuthUser | null): string[] {
  return [
    "Übersicht",
    "Mannschaften",
    "Wettkämpfe",
    "Schützen/innen",
    "Termine & Info",
    ...(user ? ["Verantwortliche"] : []),
    "PDF-Export",
  ];
}
