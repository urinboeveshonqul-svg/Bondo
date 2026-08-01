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
    },
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
