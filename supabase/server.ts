import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * The auth session lives in cookies, so the client is built per request — never
 * hoist it into a module-level singleton or one user's session will leak into
 * another user's request.
 *
 * `cache()` scopes it to a single request: a page where six components each ask
 * for a client gets one client, not six. It is per-request memoisation, not a
 * cross-request cache, so no session is shared.
 *
 * Anon-key scoped, so RLS applies. For privileged work use `createAdminClient()`
 * from `supabase/admin.ts`.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. This is expected and safe
            // to ignore: `middleware.ts` refreshes the session on every request,
            // so the browser still receives rotated tokens.
          }
        },
      },
    },
  );
});

/**
 * Returns the authenticated user, or `null`.
 *
 * Always prefer this over reading the session directly: `getUser()` validates
 * the JWT against the Supabase Auth server, whereas `getSession()` trusts the
 * cookie as-is and can be spoofed.
 *
 * That validation is a network round trip, so this is cached per request too —
 * a layout, a page and three components can all call it for the cost of one.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});
