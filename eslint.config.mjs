import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier/flat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "supabase/.temp/**",
      "supabase/.branches/**",
    ],
  },

  // `next/core-web-vitals` bundles the React, hooks and a11y rules plus the
  // Core Web Vitals checks; `next/typescript` layers on typescript-eslint.
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      // Unused variables are errors, but an underscore prefix opts out — needed
      // for positional args and intentionally ignored destructured keys.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Type-only imports are erased at compile time; enforcing the syntax
      // keeps a type import from pulling a runtime module into a bundle.
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Application code logs through `lib/logger.ts` so output stays
      // structured and parseable by a log drain.
      "no-console": ["warn", { allow: ["warn", "error"] }],

      /**
       * Locale-unaware navigation is the single easiest way to break i18n, and
       * it fails silently: `next/link` compiles, renders and looks correct, then
       * drops a Russian visitor onto `/products` — where middleware sends them
       * to Uzbek. Nothing throws and no test catches it, so it is enforced here
       * rather than left to review.
       *
       * `redirect`, `permanentRedirect`, `useRouter` and `usePathname` have the
       * same problem and the same replacements. `notFound`, `useParams` and the
       * rest of `next/navigation` are locale-agnostic and stay importable.
       */
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Import { Link } from '@/i18n/navigation' so hrefs keep the active locale.",
            },
            {
              name: "next/navigation",
              importNames: [
                "redirect",
                "permanentRedirect",
                "useRouter",
                "usePathname",
              ],
              message:
                "Import these from '@/i18n/navigation' so navigation keeps the active locale.",
            },
          ],
        },
      ],
    },
  },

  {
    /**
     * The navigation helpers are generated *from* the Next.js primitives, and
     * the middleware chain runs before any locale exists to preserve.
     */
    files: ["i18n/navigation.ts", "middleware.ts", "supabase/session.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  {
    // The logger is the one place allowed to touch `console`.
    files: ["lib/logger.ts"],
    rules: { "no-console": "off" },
  },

  {
    // Config and scripts run in Node, outside the app's logging conventions.
    files: ["*.config.{js,mjs,ts}", "scripts/**/*"],
    rules: { "no-console": "off" },
  },

  // Must stay last: turns off every stylistic rule that would fight Prettier.
  prettier,
];

export default eslintConfig;
