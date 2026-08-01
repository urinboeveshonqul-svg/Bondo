import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client.
 *
 * BYPASSES ROW LEVEL SECURITY. Reserve it for trusted server-side work that
 * genuinely cannot run under a user's session — webhook handlers, background
 * jobs, admin tooling — and authorise the caller yourself before using it.
 *
 * The `server-only` import makes bundling this into client code a build error
 * rather than a leaked key.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — createAdminClient() is unavailable",
    );
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
