#!/usr/bin/env node
/**
 * Fails the build on the mechanical signatures of translated copy.
 *
 * CLAUDE.md § 11 says Uzbek is the master language and that no string may read
 * as though it came out of a translation engine. Most of that is a judgement a
 * person has to make — but a few of the tells are exact, and those are worth
 * catching before review rather than after launch.
 *
 * It does **not** try to score writing quality. A checker that guessed at tone
 * would fail honest copy and teach everyone to ignore it. It only asserts things
 * that are wrong every time they appear.
 *
 * Run by `npm run check`.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../messages/", import.meta.url);

/**
 * Namespaces a shopper reads. The admin panel is held to the same standard for
 * tone, but it may legitimately name technical things — an administrator
 * adjusting stock is entitled to the word "SKU" — so the leak check below is
 * scoped to the storefront.
 */
const CUSTOMER_FACING = new Set([
  "common",
  "header",
  "footer",
  "home",
  "catalog",
  "product",
  "newsletter",
  "errors",
  "auth",
  "account",
]);

/**
 * Uzbek case suffixes attach to the word: `{name}ni`, never `{name} ni`.
 *
 * A space before one is the signature of a sentence assembled from an English
 * template — "add {name} to basket" with the parts moved around — rather than
 * written in Uzbek. Six of these shipped before this check existed.
 */
const DETACHED_SUFFIX =
  /\}\s+(ni|ga|da|dan|ning|niki|lar|larni|larga|lardan|imiz|ingiz)\b/;

/**
 * Words that describe our infrastructure rather than the shopper's problem.
 *
 * "The product database did not answer" tells somebody trying to buy a graphics
 * card about our architecture. It shipped in all three languages and is exactly
 * what the standard means by never exposing technical detail.
 */
const LEAKS = [
  /\bdatabase\b/i,
  /ma['’]lumotlar bazasi/i,
  /база данных/i,
  /\bserver\b/i,
  /\bсервер/i,
  /\bAPI\b/,
  /\bSQL\b/,
  /\bnull\b/i,
  /\bundefined\b/i,
  /\bexception\b/i,
  /\bstack trace\b/i,
  /\btimeout\b/i,
];

/**
 * Names that must survive untranslated in every language.
 *
 * A shopper searching for "NVIDIA" will not find "Нвидиа", and a spec sheet that
 * transliterates a model number is a spec sheet nobody trusts.
 */
const TRANSLITERATED = [
  /Нвидиа|НВИДИА/,
  /Интел\b/,
  /Амд\b/i,
  /Вай-?Фай/i,
  /Блютус|Блютуз/i,
  /Эйч-?ди-?эм-?ай/i,
  /Ссд\b/i,
];

const problems = [];

/** Walks a nested message object, yielding `[dottedKey, string]`. */
function* strings(value, path = []) {
  if (typeof value === "string") {
    yield [path.join("."), value];
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      yield* strings(child, [...path, key]);
    }
  }
}

const locales = (
  await readdir(fileURLToPath(ROOT), { withFileTypes: true })
).filter((entry) => entry.isDirectory());

for (const locale of locales) {
  const files = await readdir(fileURLToPath(new URL(`${locale.name}/`, ROOT)));

  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const namespace = file.replace(/\.json$/, "");
    const json = JSON.parse(
      await readFile(
        fileURLToPath(new URL(`${locale.name}/${file}`, ROOT)),
        "utf8",
      ),
    );

    for (const [key, value] of strings(json)) {
      const where = `${locale.name}/${namespace}.${key}`;

      if (locale.name === "uz" && DETACHED_SUFFIX.test(value)) {
        problems.push(
          `${where}\n    A case suffix is detached from its placeholder: ${JSON.stringify(value)}\n` +
            `    Uzbek attaches it — write {name}ni, not {name} ni.`,
        );
      }

      if (CUSTOMER_FACING.has(namespace)) {
        const leak = LEAKS.find((pattern) => pattern.test(value));
        if (leak) {
          problems.push(
            `${where}\n    Exposes a technical detail (${leak}): ${JSON.stringify(value)}\n` +
              `    Say what the shopper should do, not what our infrastructure did.`,
          );
        }
      }

      const transliterated = TRANSLITERATED.find((pattern) =>
        pattern.test(value),
      );
      if (transliterated) {
        problems.push(
          `${where}\n    A protected technical name was transliterated: ${JSON.stringify(value)}\n` +
            `    Intel, AMD, NVIDIA, Wi-Fi, HDMI, SSD and model numbers stay as they are.`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    `\nCopy standard violations (CLAUDE.md § 11):\n\n  ${problems.join("\n\n  ")}\n`,
  );
  process.exit(1);
}

console.log(
  `Copy OK — ${locales.length} locales checked for detached suffixes, leaked technical detail and transliterated technical names.`,
);
