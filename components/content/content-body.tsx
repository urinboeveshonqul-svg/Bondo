/**
 * Renders a content page's body.
 *
 * ## The format, and why it is this small (ADR-76)
 *
 * `content_page_translations.body` is plain text in a three-rule syntax:
 *
 * ```
 * ## A section heading
 *
 * A paragraph. Blank lines separate them.
 *
 * - a list item
 * - another one
 * ```
 *
 * That is the whole grammar. Three alternatives were available and each is
 * worse here:
 *
 * **HTML in the column** would be the flexible one, and it means rendering
 * markup that came out of a database through `dangerouslySetInnerHTML`. The
 * write path is permission-gated and RLS-protected, so this is not an open
 * door — but "an editor account can inject script into every visitor's page" is
 * a bad property to accept in exchange for formatting a warranty page.
 *
 * **Markdown** would need a parser and a sanitiser: two dependencies, both in
 * the server bundle, to support three block types out of the forty it offers.
 *
 * **A JSON block structure** in a `text` column would be more expressive and
 * would make the admin editor a form nobody can type prose into.
 *
 * So: plain text an operator can read and edit in a textarea, parsed here into
 * elements. Anything the parser does not recognise is a paragraph, which means
 * unexpected input renders as visible text rather than as markup or as nothing.
 *
 * No `"use client"`. This is a pure transform of a string into elements, so it
 * stays on the server and ships no JavaScript.
 */

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/**
 * Splits a body into blocks.
 *
 * Exported for the sake of being testable on its own — the rendering is
 * trivial, the parsing is the part with edge cases in it.
 */
export function parseContentBody(body: string): Block[] {
  const blocks: Block[] = [];

  // Blank-line separated. `\r\n` too, because copy pasted out of a Windows
  // editor into the admin textarea arrives with carriage returns and would
  // otherwise never match a paragraph break.
  const chunks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    if (chunk.startsWith("## ")) {
      blocks.push({ kind: "heading", text: chunk.slice(3).trim() });
      continue;
    }

    const lines = chunk.split("\n").map((line) => line.trim());

    // A list only when *every* line is one, so a paragraph that happens to
    // begin with a dash does not become a one-item list.
    if (lines.length > 0 && lines.every((line) => line.startsWith("- "))) {
      blocks.push({
        kind: "list",
        items: lines.map((line) => line.slice(2).trim()),
      });
      continue;
    }

    // A single newline inside a paragraph is a soft wrap in the source, not a
    // line break in the output — the same rule Markdown uses, and the one an
    // editor wrapping their text at 80 columns expects.
    blocks.push({ kind: "paragraph", text: lines.join(" ") });
  }

  return blocks;
}

export function ContentBody({ body }: { body: string }) {
  const blocks = parseContentBody(body);

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        // The index is the key because these blocks have no identity of their
        // own and the list is never reordered — it is re-parsed from the string
        // on every render.
        if (block.kind === "heading") {
          return (
            // `h2`: the page title is the `h1`, and these are its sections.
            <h2
              key={index}
              className="pt-2 text-lg font-semibold tracking-tight first:pt-0"
            >
              {block.text}
            </h2>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={index} className="space-y-1.5">
              {block.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-sm text-muted-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                  />
                  <span className="text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="text-sm text-pretty text-muted-foreground">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
