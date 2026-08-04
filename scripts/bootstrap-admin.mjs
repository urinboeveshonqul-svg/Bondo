#!/usr/bin/env node
/**
 * Creates the first administrator.
 *
 * The panel is closed to everyone who is not in `admins` (K-1), and nothing in
 * the application can put the first row there — every write path that grants a
 * role is itself gated on `admins.manage`, which nobody holds yet. That is the
 * correct shape for the running system and it means the very first
 * administrator has to be created out of band. This is that path, and it exists
 * so nobody has to open the SQL editor and hand-write inserts against six
 * tables in the right order.
 *
 *   npm run admin:bootstrap -- --email you@example.com
 *
 * ## Why this needs the service role
 *
 * Creating a confirmed auth user and granting a role are both refused by RLS to
 * every client key, by design. So this script uses `SUPABASE_SERVICE_ROLE_KEY`
 * — which is why it is a **script and never a route**. Nothing in `app/`,
 * `services/` or `actions/` may import the service-role client; putting this
 * behind an HTTP endpoint would turn "create the first admin" into "create an
 * admin", which is a privilege-escalation endpoint with a friendly name.
 *
 * ## Safe to run more than once
 *
 * Every step is idempotent and checked before it is taken:
 *
 *   * an existing auth user is reused rather than duplicated;
 *   * an existing `admins` row is reactivated rather than inserted twice;
 *   * the role grant is a no-op if it is already there;
 *   * **it refuses to run when an active administrator already exists**, unless
 *     `--force` is passed. The dangerous version of this script is one that
 *     silently promotes a seventh person months later because it was left in a
 *     deploy hook.
 *
 * ## What it does not do
 *
 * It does not invent a role. `super_admin` is the schema's, protected from
 * rename by a trigger (ADR-44), and `--role` accepts only keys that exist in
 * `public.roles`.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const ROOT = new URL("../", import.meta.url);

// -----------------------------------------------------------------------------
// Arguments
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);

function flag(name, fallback = undefined) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;

  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : true;
}

const email = flag("email");
const roleKey = flag("role", "super_admin");
const fullName = flag("name", null);
const force = flag("force", false) === true;

if (!email || email === true) {
  console.error(`
Create the first administrator.

  npm run admin:bootstrap -- --email you@example.com [options]

  --email <address>   required
  --name  <name>      full name for the profile
  --role  <key>       role to grant (default: super_admin)
  --force             proceed even if an active administrator already exists

The password is generated and printed once. Sign in with it, then change it
from /account/security.
`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------
// `.env.local` is read directly rather than through `lib/env.ts`: that module
// validates the *public* contract and this script needs the one variable the
// application deliberately never loads.
async function loadEnv() {
  const merged = { ...process.env };

  for (const file of [".env.local", ".env"]) {
    try {
      const text = await readFile(new URL(file, ROOT), "utf8");
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim() || line.startsWith("#")) continue;
        const index = line.indexOf("=");
        if (index === -1) continue;
        const key = line.slice(0, index).trim();
        if (!(key in merged)) merged[key] = line.slice(index + 1).trim();
      }
    } catch {
      // Absent is fine — the value may come from the real environment.
    }
  }

  return merged;
}

const env = await loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    [
      "Missing configuration.",
      "",
      `  NEXT_PUBLIC_SUPABASE_URL       ${url ? "set" : "MISSING"}`,
      `  SUPABASE_SERVICE_ROLE_KEY     ${serviceKey ? "set" : "MISSING"}`,
      "",
      "The service role key bypasses RLS and is required to create the first",
      "administrator. Copy it from Project → Settings → API into .env.local.",
      "It must never be committed and is never read by the application.",
    ].join("\n"),
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const step = (message) => console.log(`  ${message}`);
const fail = (message, detail) => {
  console.error(`\n✗ ${message}`);
  if (detail) console.error(`  ${detail}`);
  process.exit(1);
};

console.log(`\nBootstrapping an administrator on ${url}\n`);

// -----------------------------------------------------------------------------
// 0. Refuse to run when the store already has staff
// -----------------------------------------------------------------------------
const { data: existing, error: existingError } = await supabase
  .from("admins")
  .select("user_id, is_active")
  .is("deleted_at", null)
  .eq("is_active", true);

if (existingError)
  fail("Could not read the admin register.", existingError.message);

if (existing.length > 0 && !force) {
  fail(
    `${existing.length} active administrator(s) already exist.`,
    "This command is for the first one. Add colleagues from the admin panel, or pass --force if you are certain.",
  );
}

// -----------------------------------------------------------------------------
// 1. The role has to exist
// -----------------------------------------------------------------------------
const { data: role, error: roleError } = await supabase
  .from("roles")
  .select("id, key, name")
  .eq("key", roleKey)
  .maybeSingle();

if (roleError) fail("Could not read roles.", roleError.message);
if (!role) {
  const { data: available } = await supabase.from("roles").select("key");
  fail(
    `No role with key "${roleKey}".`,
    `Available: ${(available ?? []).map((r) => r.key).join(", ")}`,
  );
}

step(`role ............. ${role.key}`);

// -----------------------------------------------------------------------------
// 2. The auth user — reused if the address is already registered
// -----------------------------------------------------------------------------
const password = `${randomBytes(12).toString("base64url")}aA1!`;

let userId;
let generatedPassword = null;

const { data: created, error: createError } =
  await supabase.auth.admin.createUser({
    email,
    password,
    // Confirmed on creation: the operator bootstrapping a store cannot receive
    // a verification email before the store can send one.
    email_confirm: true,
    user_metadata: fullName && fullName !== true ? { full_name: fullName } : {},
  });

if (created?.user) {
  userId = created.user.id;
  generatedPassword = password;
  step(`auth user ........ created (${email})`);
} else if (createError && /already/i.test(createError.message)) {
  // `listUsers` is paginated; the address is unique so the first page holding a
  // match is the answer. 200 is comfortably above any realistic bootstrap.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError)
    fail("Could not look up the existing user.", listError.message);

  const match = list.users.find(
    (user) => user.email?.toLowerCase() === String(email).toLowerCase(),
  );

  if (!match) {
    fail(
      "The address is registered but was not found in the first page of users.",
      "Promote it from the admin panel instead.",
    );
  }

  userId = match.id;
  step(`auth user ........ already existed, reusing (${email})`);
} else {
  fail("Could not create the auth user.", createError?.message);
}

// -----------------------------------------------------------------------------
// 3. Profile — created by the trigger, verified here
// -----------------------------------------------------------------------------
// `handle_new_user()` creates the profile and the default wishlist inside the
// signup transaction (ADR-59). This asserts that it happened rather than
// re-creating it: if the trigger is missing, the right outcome is a loud
// failure, not a script that quietly papers over it.
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, full_name")
  .eq("id", userId)
  .maybeSingle();

if (profileError) fail("Could not read the profile.", profileError.message);
if (!profile) {
  fail(
    "No profile row was created for the user.",
    "The handle_new_user trigger did not run — check that migrations are applied.",
  );
}

if (fullName && fullName !== true && profile.full_name !== fullName) {
  await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
}

step("profile .......... present");

const { count: wishlistCount } = await supabase
  .from("wishlists")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId);

step(
  wishlistCount > 0
    ? "wishlist ......... present"
    : "wishlist ......... MISSING (trigger predates 20260806001000)",
);

// -----------------------------------------------------------------------------
// 4. Admin register
// -----------------------------------------------------------------------------
const { data: adminRow } = await supabase
  .from("admins")
  .select("id, is_active")
  .eq("user_id", userId)
  .maybeSingle();

if (!adminRow) {
  const { error } = await supabase
    .from("admins")
    .insert({ user_id: userId, is_active: true, job_title: "Owner" });

  if (error) fail("Could not create the admin record.", error.message);
  step("admin record ..... created");
} else {
  const { error } = await supabase
    .from("admins")
    .update({ is_active: true, deleted_at: null })
    .eq("user_id", userId);

  if (error) fail("Could not reactivate the admin record.", error.message);
  step("admin record ..... reactivated");
}

// -----------------------------------------------------------------------------
// 5. Role grant
// -----------------------------------------------------------------------------
const { error: grantError } = await supabase
  .from("user_roles")
  .upsert(
    { user_id: userId, role_id: role.id },
    { onConflict: "user_id,role_id" },
  );

if (grantError) fail("Could not grant the role.", grantError.message);
step(`role grant ....... ${role.key}`);

// -----------------------------------------------------------------------------
// 6. Verify what was actually granted
// -----------------------------------------------------------------------------
// Read back rather than trust the writes: this is the only place that can
// confirm the new administrator will pass `requireAdmin()` and `has_permission`.
const { data: verify, error: verifyError } = await supabase
  .from("user_roles")
  .select(
    "role:roles ( key, role_permissions ( permission:permissions ( key ) ) )",
  )
  .eq("user_id", userId);

if (verifyError) fail("Could not verify the grant.", verifyError.message);

const permissions = new Set();
for (const row of verify ?? []) {
  for (const grant of row.role?.role_permissions ?? []) {
    if (grant.permission?.key) permissions.add(grant.permission.key);
  }
}

if (permissions.size === 0) {
  fail(
    "The role was granted but resolves to no permissions.",
    "role_permissions is empty for this role — check that the identity migration ran.",
  );
}

step(`permissions ...... ${permissions.size} resolved`);

// -----------------------------------------------------------------------------
// 7. Record it
// -----------------------------------------------------------------------------
// `audit_logs` is append-only and immutable even to the service role (ADR-27),
// so this entry is permanent evidence of an out-of-band privilege grant — which
// is exactly the kind of event an audit log exists for.
const { error: auditError } = await supabase.from("audit_logs").insert({
  actor_id: userId,
  // Dotted, because `audit_logs_action_format` requires `resource.action`.
  action: "admins.bootstrap",
  actor_email: email,
  resource_type: "admins",
  resource_id: userId,
  metadata: { email, role: role.key, forced: force },
});

step(
  auditError
    ? `audit ............ NOT recorded (${auditError.message})`
    : "audit ............ recorded",
);

// -----------------------------------------------------------------------------
// Done
// -----------------------------------------------------------------------------
console.log(`\n✓ ${email} is now an administrator (${role.key}).\n`);

if (generatedPassword) {
  console.log("  Generated password — shown once, store it now:\n");
  console.log(`      ${generatedPassword}\n`);
  console.log("  Sign in, then change it at /account/security.\n");
} else {
  console.log("  The account already existed; its password is unchanged.\n");
}
