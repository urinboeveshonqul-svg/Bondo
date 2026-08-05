// Relative, not the `@/` alias — this module is reachable from `middleware.ts`
// and Vercel resolves that graph itself without tsconfig `paths` (ADR-34).
import { defaultLocale, isLocale, type Locale } from "./site-config";

/**
 * Single source of truth for internal URLs.
 *
 * Route strings are never hard-coded in components — importing them from here
 * means a path change is one edit, and TypeScript catches every call site.
 * Routes are declared for the full storefront; the pages themselves are added
 * in later phases.
 *
 * **These paths carry no locale prefix.** `<Link>` from `@/i18n/navigation`
 * adds the active locale, so a route declared once here works in all three
 * languages. Keeping the prefix out of this file means route constants stay
 * comparable — `pathname === routes.cart` is still a valid check — and adding a
 * locale never touches this table.
 */
export const routes = {
  home: "/",

  catalog: {
    index: "/products",
    detail: (slug: string) => `/products/${slug}`,
    /**
     * A category is a filtered listing, not a separate page. One template means
     * one place where sorting, pagination and empty states are implemented, and
     * a shopper narrowing by category keeps whatever else they had set.
     * `category(slug)` remains for a future dedicated landing page with its own
     * copy and metadata; nothing links to it yet.
     */
    byCategory: (slug: string) =>
      `/products?category=${encodeURIComponent(slug)}`,
    category: (slug: string) => `/categories/${slug}`,
    search: "/search",
  },

  cart: "/cart",
  checkout: "/checkout",
  /**
   * Where a placed order lands.
   *
   * The reference travels in the query string rather than the path, and the page
   * renders it without fetching anything. That is forced by the schema, not a
   * shortcut: most orders are placed by guests, and a guest holds no read
   * privilege on `orders` at all — so there is no order for this page to load.
   * The action returns the reference; the page shows it.
   */
  checkoutSuccess: (reference: string) =>
    `/checkout/success?ref=${encodeURIComponent(reference)}`,

  auth: {
    signIn: "/sign-in",
    signUp: "/sign-up",
    signOut: "/sign-out",
    /**
     * Where every email link lands. It exchanges the `code` for a session and
     * then forwards, so no page has to know how a link becomes a session.
     */
    callback: "/auth/callback",
    forgotPassword: "/forgot-password",
    /** Reached from the recovery email, via the callback. */
    resetPassword: "/reset-password",
    /** "Check your inbox", and where an unverified account is sent. */
    verifyEmail: "/verify-email",
  },

  account: {
    index: "/account",
    orders: "/account/orders",
    order: (id: string) => `/account/orders/${id}`,
    addresses: "/account/addresses",
    profile: "/account/profile",
    security: "/account/security",
  },

  admin: {
    index: "/admin",
    products: "/admin/products",
    productNew: "/admin/products/new",
    product: (id: string) => `/admin/products/${id}`,
    categories: "/admin/categories",
    brands: "/admin/brands",
    inventory: "/admin/inventory",
    homepage: "/admin/homepage",
    content: "/admin/content",
    contentPage: (slug: string) => `/admin/content/${slug}`,
    settings: "/admin/settings",
    users: "/admin/users",
    audit: "/admin/audit",
    orders: "/admin/orders",
    order: (id: string) => `/admin/orders/${id}`,
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

/**
 * Splits a locale prefix off an incoming pathname.
 *
 * Every URL the middleware sees is prefixed (`/uz/account`), while everything in
 * `routes` is not (`/account`). Comparing the two directly is the bug this
 * exists to prevent: `"/uz/account".startsWith("/account")` is false, so a
 * protected route would read as public and the sign-in gate would never fire.
 *
 * An unrecognised first segment is not a locale — `/products` returns the
 * default locale and the path untouched, so this is safe to call on any URL.
 */
export function splitLocale(pathname: string): {
  locale: Locale;
  pathname: string;
} {
  const [, first = "", ...rest] = pathname.split("/");

  if (!isLocale(first)) return { locale: defaultLocale, pathname };

  return { locale: first, pathname: `/${rest.join("/")}` };
}

/** Prefixes an unprefixed route with a locale: `("uz", "/products")` → `/uz/products`. */
export function localizePath(locale: Locale, pathname: string): string {
  const [path = "", query] = pathname.split("?");
  const base = path === "/" ? `/${locale}` : `/${locale}${path}`;

  return query ? `${base}?${query}` : base;
}

/**
 * Accepts a pathname with or without a locale prefix — middleware sees the
 * prefixed form, tests and server code often do not.
 */
export function isProtectedRoute(pathname: string): boolean {
  const { pathname: path } = splitLocale(pathname);

  return protectedRoutePrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
