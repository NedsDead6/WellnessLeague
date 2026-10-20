export interface League {
  id: string;
  name: string;
  invite_code: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
