import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Client Components.
 *
 * Uses the anon key and is therefore fully governed by Row Level Security —
 * treat every query from here as untrusted input to the database.
 *
 * `createBrowserClient` memoises internally, so calling this on every render is
 * safe and does not open a new connection.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
