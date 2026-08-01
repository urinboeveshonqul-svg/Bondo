/**
 * Single source of truth for internal URLs.
 *
 * Route strings are never hard-coded in components — importing them from here
 * means a path change is one edit, and TypeScript catches every call site.
 * Routes are declared for the full storefront; the pages themselves are added
 * in later phases.
 */
export const routes = {
  home: "/",

  catalog: {
    index: "/products",
    detail: (slug: string) => `/products/${slug}`,
    category: (slug: string) => `/categories/${slug}`,
    search: "/search",
  },

  cart: "/cart",
  checkout: "/checkout",

  auth: {
    signIn: "/sign-in",
    signUp: "/sign-up",
    signOut: "/sign-out",
    callback: "/auth/callback",
    forgotPassword: "/forgot-password",
  },

  account: {
    index: "/account",
    orders: "/account/orders",
    order: (id: string) => `/account/orders/${id}`,
    addresses: "/account/addresses",
    profile: "/account/profile",
  },

  admin: {
    index: "/admin",
  },
} as const;

/**
 * Route prefixes that require a signed-in user.
 *
 * This is **authentication only**. Middleware checks that a valid session
 * exists; it does not and must not check roles. Deciding "is this user an
 * admin" needs a database read, and doing that on the Edge for every request
 * would put a query in front of the whole site.
 *
 * `/admin` therefore needs a second, role-based check in its own layout, using
 * the server Supabase client. Middleware only guarantees that whoever reaches
 * `/admin` is logged in as *someone* — every signed-in customer passes this
 * gate. The authorisation boundary for admin data is RLS plus that layout
 * check, never this list.
 */
export const protectedRoutePrefixes = [
  "/account",
  "/checkout",
  "/admin",
] as const;

export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
