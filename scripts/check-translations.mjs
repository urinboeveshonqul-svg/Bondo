#!/usr/bin/env node
/**
 * Fails the build when the three locales have drifted apart.
 *
 * The internationalization policy says a feature is not complete until Uzbek,
 * Russian and English all exist for it. A policy nobody can enforce is a
 * suggestion, and the failure mode it guards against is quiet: a key added in
 * English only renders as its own key path in the other two, which looks like a
 * styling bug and survives review.
 *
 * Checks, in order of how badly each one bites:
 *
 *  1. Every namespace file exists in every locale.
 *  2. Every key path exists in every locale — reported both ways, because an
 *     *extra* key is usually a rename that was applied to one locale only.
 *  3. No value is an empty string. An empty translation is worse than a missing
 *     one: it passes the key check and renders as nothing at all.
 *  4. ICU placeholders match across locales. `{count}` translated as `{soni}`
 *     throws at render time, in production, in one language.
 *
 * Run by `npm run check`, so it gates every commit and every deploy.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// `fileURLToPath`, not `URL.pathname`: the latter stays percent-encoded, so any
// checkout under a path containing a space resolves to a directory that does not
// exist. It also handles the leading slash before a Windows drive letter.
const MESSAGES_DIR = fileURLToPath(new URL("../messages/", import.meta.url));

/** Flattens `{a: {b: "x"}}` to `{"a.b": "x"}` so key paths compare directly. */
function flatten(value, prefix = "") {
  const out = {};

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(out, flatten(child, path));
    } else {
      out[path] = child;
    }
  }

  return out;
}

/**
 * Extracts ICU argument names, ignoring the plural/select machinery.
 *
 * `{count, plural, one {# product} other {# products}}` contributes `count` and
 * nothing else — the branch keywords are ICU syntax, not arguments, and they
 * legitimately differ between locales (Russian has `few` and `many`; English
 * does not).
 */
function placeholders(message) {
  if (typeof message !== "string") return new Set();

  const names = new Set();
  for (const match of message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)) {
    names.add(match[1]);
  }

  return names;
}

const locales = (await readdir(MESSAGES_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (locales.length === 0) {
  console.error("No locale folders found in messages/.");
  process.exit(1);
}

// The reference locale is whichever has the most namespaces, so a namespace
// missing everywhere except one is reported as missing from the others rather
// than as an extra in the one that has it.
const byLocale = {};
for (const locale of locales) {
  const files = (await readdir(join(MESSAGES_DIR, locale)))
    .filter((name) => name.endsWith(".json"))
    .sort();

  byLocale[locale] = {};
  for (const file of files) {
    const namespace = file.replace(/\.json$/, "");
    const raw = await readFile(join(MESSAGES_DIR, locale, file), "utf8");

    try {
      byLocale[locale][namespace] = flatten(JSON.parse(raw));
    } catch (error) {
      console.error(
        `Invalid JSON: messages/${locale}/${file}\n  ${error.message}`,
      );
      process.exit(1);
    }
  }
}

const allNamespaces = [
  ...new Set(Object.values(byLocale).flatMap((ns) => Object.keys(ns))),
].sort();

const problems = [];

for (const namespace of allNamespaces) {
  const present = locales.filter((locale) => byLocale[locale][namespace]);
  const missing = locales.filter((locale) => !byLocale[locale][namespace]);

  if (missing.length > 0) {
    problems.push(
      `messages/{${missing.join(",")}}/${namespace}.json is missing ` +
        `(present in ${present.join(", ")}).`,
    );
    continue;
  }

  const union = [
    ...new Set(
      present.flatMap((locale) => Object.keys(byLocale[locale][namespace])),
    ),
  ].sort();

  for (const key of union) {
    const absent = present.filter(
      (locale) => !(key in byLocale[locale][namespace]),
    );

    if (absent.length > 0) {
      problems.push(
        `${namespace}.${key} is missing from: ${absent.join(", ")}.`,
      );
      continue;
    }

    const empty = present.filter(
      (locale) => String(byLocale[locale][namespace][key]).trim() === "",
    );
    if (empty.length > 0) {
      problems.push(`${namespace}.${key} is empty in: ${empty.join(", ")}.`);
    }

    // Placeholder parity, compared against the first locale that has the key.
    const [reference] = present;
    const expected = placeholders(byLocale[reference][namespace][key]);

    for (const locale of present.slice(1)) {
      const actual = placeholders(byLocale[locale][namespace][key]);
      const lost = [...expected].filter((name) => !actual.has(name));
      const gained = [...actual].filter((name) => !expected.has(name));

      if (lost.length > 0 || gained.length > 0) {
        problems.push(
          `${namespace}.${key} placeholder mismatch in ${locale}: ` +
            [
              lost.length > 0 ? `missing {${lost.join("}, {")}}` : "",
              gained.length > 0 ? `unexpected {${gained.join("}, {")}}` : "",
            ]
              .filter(Boolean)
              .join(", ") +
            ` (${reference} has ${expected.size > 0 ? `{${[...expected].join("}, {")}}` : "none"}).`,
        );
      }
    }
  }
}

const keyCount = Object.values(byLocale[locales[0]] ?? {}).reduce(
  (total, ns) => total + Object.keys(ns).length,
  0,
);

if (problems.length > 0) {
  console.error(
    `\nTranslations are out of sync across ${locales.join(", ")}:\n\n` +
      problems.map((problem) => `  • ${problem}`).join("\n") +
      `\n\nEvery user-facing string must exist in all ${locales.length} languages ` +
      `before a feature is complete — see CLAUDE.md § 11.\n`,
  );
  process.exit(1);
}

console.log(
  `Translations OK — ${allNamespaces.length} namespaces × ${locales.length} locales, ` +
    `${keyCount} keys each (${locales.join(", ")}).`,
);
