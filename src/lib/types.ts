export interface League {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  /** The commissioner's scoring rules; empty means the standard rules. */
  scoring: unknown;
  created_at: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
