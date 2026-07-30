// Shape and display rule for the announcement banner fed by status.json in
// the GitHub repo (see components/StatusNotice.tsx).

export type StatusMessage = {
  active?: boolean;
  /** Changing the id makes a dismissed message appear again for everyone. */
  id?: string;
  level?: "info" | "warning";
  title?: string;
  message?: string;
};

/** Decides whether a fetched message should be shown at all. */
export function shouldShow(status: StatusMessage | null, dismissedId: string | null): boolean {
  if (!status?.active) return false;
  if (!status.message) return false;
  return status.id !== dismissedId;
}
