#!/usr/bin/env node
/**
 * Fails the build when a UI vocabulary diverges from the database.
 *
 * CLAUDE.md § 12 makes the schema the source of truth. The failure it guards
 * against is quiet and expensive: a hand-written union compiles, renders a
 * `<Select>`, and then the insert is rejected by the enum — in production, on a
 * value the operator was offered. That is exactly how **K-16** happened, and it
 * survived a whole phase because nothing compared the two.
 *
 * The comparison is against `Constants` in `types/database.ts`, which the
 * generator emits from the real enums, so this check is only as current as
 * `npm run db:types`. That is the intended coupling: regenerate, and a schema
 * change that orphans a UI value fails here rather than at runtime.
 *
 * Run by `npm run check`.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

const read = async (path) =>
  readFile(fileURLToPath(new URL(path, ROOT)), "utf8");

/**
 * Vocabularies with no database counterpart **yet**.
 *
 * Each needs a reason and the table that will own it, so the exception is a
 * decision someone can find rather than an omission. When the table lands, the
 * type becomes `Enums<"…">` and its entry here is deleted.
 */
const DECLARED_EXCEPTIONS = [
  {
    type: "ProductBadge",
    // Flagged from 20260809001000 onwards because `order_status` also has a
    // `new`, and the overlap rule cannot tell a coincidence from a divergence.
    // It is a coincidence: a "New" flash on a product card and an order nobody
    // has rung about yet are unrelated vocabularies that happen to share an
    // English word. Badges are computed from `products.published_at`,
    // `is_featured` and the stock level — there is no column to derive them
    // from, and there is not meant to be.
    reason: "presentation flags computed from product columns, not stored",
    owner: "none — interface vocabulary",
  },
  {
    type: "HomepageSectionType",
    reason: "section types map to components, not rows",
    owner: "none — interface vocabulary",
  },
  {
    type: "AuditAction",
    reason: "audit_logs.action is free text, not an enum",
    owner: "public.audit_logs.action",
  },
];

const problems = [];
const notes = [];

// -----------------------------------------------------------------------------
// The database's enums, as the generator emitted them.
// -----------------------------------------------------------------------------
const databaseTs = await read("types/database.ts");

const constantsBlock = databaseTs.match(
  /export const Constants = \{[\s\S]*?\n\} as const/,
);

if (!constantsBlock) {
  console.error(
    "Could not find `Constants` in types/database.ts.\n" +
      "Run `npm run db:types` — the file predates the generator that emits it.",
  );
  process.exit(1);
}

/** `enumName -> [values]`, parsed from the emitted `Constants`. */
const dbEnums = new Map();
for (const match of constantsBlock[0].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
  const values = [...match[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (values.length > 0) dbEnums.set(match[1], values.sort());
}

if (dbEnums.size === 0) {
  console.error("No enums found in `Constants`. Has the schema any?");
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Types that must be derived, not re-typed.
// -----------------------------------------------------------------------------
const SOURCES = [
  "types/catalog.ts",
  "types/admin.ts",
  "utils/admin.ts",
  "lib/admin/permissions.ts",
];

const declaredExceptionNames = new Set(DECLARED_EXCEPTIONS.map((e) => e.type));

for (const path of SOURCES) {
  const source = await read(path);

  // `export type X = "a" | "b" | …` — a hand-written union of string literals.
  for (const match of source.matchAll(
    /export type (\w+) =\s*((?:\s*\|?\s*"[^"]+")+)\s*;/g,
  )) {
    const [, name, body] = match;
    const values = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();

    if (declaredExceptionNames.has(name)) {
      notes.push(`${name} (${path}) — declared exception`);
      continue;
    }

    // Does any database enum have exactly these values? If so the union is a
    // duplicate of it and should be derived instead.
    const twin = [...dbEnums.entries()].find(
      ([, dbValues]) =>
        dbValues.length === values.length &&
        dbValues.every((value, i) => value === values[i]),
    );

    if (twin) {
      problems.push(
        `${path}: \`${name}\` re-types the \`${twin[0]}\` enum.\n` +
          `      Use \`Enums<"${twin[0]}">\` so a schema change reaches it.`,
      );
      continue;
    }

    // Or does it *overlap* one — sharing values but disagreeing on the set?
    // That is the K-16 shape and the more dangerous of the two.
    for (const [dbName, dbValues] of dbEnums) {
      const shared = values.filter((value) => dbValues.includes(value));
      if (shared.length === 0) continue;

      const extra = values.filter((value) => !dbValues.includes(value));
      if (extra.length === 0) continue;

      problems.push(
        `${path}: \`${name}\` overlaps the \`${dbName}\` enum but adds ` +
          `${extra.map((v) => `"${v}"`).join(", ")}.\n` +
          `      The database would reject ${extra.length === 1 ? "that value" : "those values"}. ` +
          `Derive from \`Enums<"${dbName}">\`, or migrate the enum.\n` +
          `      database: ${dbValues.join(" | ")}\n` +
          `      code:     ${values.join(" | ")}`,
      );
      break;
    }
  }
}

// -----------------------------------------------------------------------------
if (problems.length > 0) {
  console.error(
    `\nUI vocabulary has diverged from the database schema:\n\n` +
      problems.map((problem) => `  • ${problem}`).join("\n\n") +
      `\n\nThe schema is the source of truth — see CLAUDE.md § 12.\n` +
      `A vocabulary with no column yet is allowed, but must be declared in\n` +
      `scripts/check-enums.mjs with a reason.\n`,
  );
  process.exit(1);
}

console.log(
  `Enums OK — ${dbEnums.size} database enums (${[...dbEnums.keys()].join(", ")}); ` +
    `${notes.length} declared exception${notes.length === 1 ? "" : "s"}.`,
);
