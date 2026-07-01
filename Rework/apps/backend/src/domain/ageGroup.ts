// Mirrors model/Agegroup.java - the legacy DB stores these exact German
// display strings in the `agegroup` column, not enum constant names.
export const AGE_GROUPS = ["Schützenklasse", "Senioren"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export function isAgeGroup(value: string): value is AgeGroup {
  return (AGE_GROUPS as readonly string[]).includes(value);
}
