#!/usr/bin/env node
/**
 * Resolves the Supabase project a verification harness is allowed to write to.
 *
 * ## Why this exists
 *
 * Every harness used to open `.env.local` and read `NEXT_PUBLIC_SUPABASE_URL`
 * and `SUPABASE_SERVICE_ROLE_KEY` — the production credentials, because that is
 * what `.env.local` is for. There was no other code path. Running a harness
 * therefore *always* wrote to the live shop, and nobody had to make a mistake
 * for it to happen.
 *
 * The cost was not hypothetical. On 2026-08-14 the hosted project contained 11
 * fixture products, 12 fixture brands, 5 `Guest Tester` orders, 11 permanent
 * `inventory_movements` rows that can never be deleted, and **five active Super
 * Administrator accounts with full permissions**. One fixture product was live
 * and purchasable on `bondo.uz`. That is **K-26**, and this module is the fix.
 *
 * ## The rule
 *
 * A harness runs against a project that has been **nominated as the test
 * target**, and nowhere else. `.env.local` is never consulted. There is no
 * fallback, because a fallback is how the original defect worked: the safe path
 * was optional and the dangerous one was the default.
 *
 * Set these, in `.env.test.local` (already covered by the `.env.*` rule in
 * `.gitignore`) or in the environment:
 *
 *   SUPABASE_TEST_URL=https://<test-project-ref>.supabase.co
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=...
 *   SUPABASE_TEST_ANON_KEY=...
 *
 * With nothing set, a harness refuses to run and says what to set. Failing
 * loudly is the point: a harness that silently found *some* database to write
 * to is the thing being removed.
 *
 * ## Belt and braces
 *
 * The nominated target is checked against `PROTECTED_REFS` as well. Pasting the
 * production URL into `SUPABASE_TEST_URL` is the obvious way to defeat a rule
 * like this one, so it is refused explicitly rather than trusted.
 *
 * ## The escape hatch, and why it is ugly
 *
 * Cleaning up after a past accident is a real need — that is how the fixtures
 * above were removed. So production is reachable, but only by setting
 * `BONDO_I_UNDERSTAND_THIS_WRITES_TO_PRODUCTION=yes`. It is deliberately too
 * long to type by habit, it cannot be set by accident, and it greps. What it is
 * not is a flag anybody reaches for to make an error message go away.
 *
 * Note that `scripts/bootstrap-admin.mjs` is **not** a harness and does not use
 * this module. Provisioning the real administrator on the real project is its
 * entire purpose.
 */
import { existsSync, readFileSync } from "node:fs";

/**
 * Projects a harness must never write to, whatever the environment says.
 *
 * Hard-coded rather than derived from `supabase/.temp/`, which is gitignored:
 * on a fresh clone that directory does not exist, and a guard that quietly
 * stops guarding is worse than none. Extend with `SUPABASE_PROTECTED_REFS` as
 * a comma-separated list.
 */
const PROTECTED_REFS = new Set(
  [
    "pgxqnezwrwfgrmamlxhs", // Bondo production
    ...(process.env.SUPABASE_PROTECTED_REFS ?? "").split(","),
  ]
    .map((ref) => ref.trim())
    .filter(Boolean),
);

const OVERRIDE = "BONDO_I_UNDERSTAND_THIS_WRITES_TO_PRODUCTION";
const TEST_ENV_FILE = ".env.test.local";

/** Same shape the harnesses parsed inline, in one place instead of four. */
function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [
          line.slice(0, i).trim(),
          line
            .slice(i + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

/** `https://abcd.supabase.co` → `abcd`. The ref is the identity of a project. */
function refOf(url) {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return null;
  }
}

function fail(message) {
  // Thrown rather than `process.exit`, so a caller that wants to catch it can,
  // and so the stack names the harness that asked.
  throw new Error(`[harness-target] ${message}`);
}

/**
 * @param {{ name: string, needsAnonKey?: boolean }} options
 * @returns {{ url: string, serviceRoleKey: string, anonKey: string | null, ref: string, isProduction: boolean }}
 */
export function harnessTarget({ name, needsAnonKey = false }) {
  const file = readEnvFile(TEST_ENV_FILE);
  const pick = (key) => process.env[key] ?? file[key];

  const url = pick("SUPABASE_TEST_URL");
  const serviceRoleKey = pick("SUPABASE_TEST_SERVICE_ROLE_KEY");
  const anonKey = pick("SUPABASE_TEST_ANON_KEY") ?? null;
  const override = process.env[OVERRIDE] === "yes";

  if (!url || !serviceRoleKey) {
    if (!override) {
      fail(
        `${name} has no test project to run against.\n\n` +
          `  This harness writes rows, so it will not fall back to .env.local —\n` +
          `  that is exactly how the production shop ended up full of fixtures (K-26).\n\n` +
          `  Create a second Supabase project and put its credentials in ${TEST_ENV_FILE}:\n\n` +
          `    SUPABASE_TEST_URL=https://<test-project-ref>.supabase.co\n` +
          `    SUPABASE_TEST_SERVICE_ROLE_KEY=...\n` +
          `    SUPABASE_TEST_ANON_KEY=...\n\n` +
          `  Apply the schema to it with:  supabase db push --db-url <its connection string>\n\n` +
          `  To run against production anyway — which is almost never what you want —\n` +
          `  set ${OVERRIDE}=yes and pass the production URL and key in the same variables.`,
      );
    }

    fail(
      `${name}: ${OVERRIDE} is set, but SUPABASE_TEST_URL and\n` +
        `  SUPABASE_TEST_SERVICE_ROLE_KEY still have to be given explicitly. The override\n` +
        `  permits a dangerous target; it does not guess one.`,
    );
  }

  const ref = refOf(url);
  if (!ref) fail(`${name}: SUPABASE_TEST_URL is not a URL.`);

  const isProduction = PROTECTED_REFS.has(ref);

  if (isProduction && !override) {
    fail(
      `${name} was pointed at a protected project: ${ref}.\n\n` +
        `  This is the production shop. Writing fixtures here is K-26, the defect\n` +
        `  this guard exists to prevent — putting the production URL into\n` +
        `  SUPABASE_TEST_URL does not make it a test project.\n\n` +
        `  Point SUPABASE_TEST_URL at a project that is not ${ref}, or, if you really\n` +
        `  are cleaning up after an earlier accident, set ${OVERRIDE}=yes.`,
    );
  }

  if (needsAnonKey && !anonKey) {
    fail(
      `${name} signs in as a real user, so it needs SUPABASE_TEST_ANON_KEY as well\n` +
        `  as the service-role key. Writing everything through the service role would\n` +
        `  bypass RLS and prove nothing about what an administrator may actually do.`,
    );
  }

  if (isProduction) {
    console.warn(
      `\n!!  ${name} is running against PRODUCTION (${ref}) because ${OVERRIDE} is set.\n` +
        `!!  Every row it writes lands in the live shop, and inventory_movements rows\n` +
        `!!  can never be deleted. Interrupt now if this was not deliberate.\n`,
    );
  } else {
    console.log(`[harness-target] ${name} → test project ${ref}`);
  }

  return { url, serviceRoleKey, anonKey, ref, isProduction };
}
