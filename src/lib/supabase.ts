import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Both values are safe to expose in the browser. The database's row level
// security rules are what protect people's data.
// Next.js only exposes variables when they are written out in full like this.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null when the connection values aren't set, so the demo still works. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
