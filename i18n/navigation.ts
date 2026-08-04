import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and the `next/navigation` helpers.
 *
 * **Import `Link` from here, never from `next/link`.** These wrappers take the
 * unprefixed paths declared in `lib/routes.ts` and add the active locale, so
 * `<Link href={routes.catalog.index}>` resolves to `/uz/products` for an Uzbek
 * visitor and `/ru/products` for a Russian one. `lib/routes.ts` stays the single
 * source of truth for route shapes and gains no locale awareness of its own —
 * one concern per module, and route strings that stay comparable in tests.
 *
 * A stray `next/link` import compiles and renders, then drops the visitor onto
 * the default locale the moment they click. ESLint enforces this rather than
 * leaving it to review — see the `no-restricted-imports` rule in
 * `eslint.config.mjs`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
