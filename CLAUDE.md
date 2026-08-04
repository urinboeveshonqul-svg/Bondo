# CLAUDE.md

Instructions for Claude Code working in this repository. These are standing
rules, not suggestions.

---

## 1. Read this first, every session

Before writing a single line of code:

1. **Read [PROJECT_STATUS.md](PROJECT_STATUS.md)** — current phase, what exists,
   known issues, technical debt, and the "Next task" section.
2. **Read [ROADMAP.md](ROADMAP.md)** — confirm the requested work belongs to the
   current phase.
3. **Skim [CHANGELOG.md](CHANGELOG.md)** if the change touches something recent.

`PROJECT_STATUS.md` is the source of truth for state. If it disagrees with the
code, **the code is right** — fix the document and say that you did.

---

## 2. Never rewrite completed work

Completed phases are done. Do not refactor, restructure or "improve" them
because a different approach occurred to you.

You may change completed work only when:

- The user asks for it directly, **or**
- It is a genuine bug — wrong behaviour, not merely a style you would not have
  chosen, **or**
- The current task cannot be completed without the change.

In the second and third cases: state what is broken and why, make the smallest
change that fixes it, and record it in `CHANGELOG.md`.

**Never** delete or rewrite a file because it is easier than reading it.

---

## 3. Follow the roadmap

- Work the current phase only. Do not start the next phase because the current
  one looks finished — the user decides that.
- If a request belongs to a later phase, say so and ask before proceeding.
- If the current phase is blocked, do every unblocked part in full and state
  precisely what was left and why.
- Do not add features nobody asked for. Scaffolding "for later" is speculation,
  and speculation becomes technical debt.

---

## 4. Preserve the architecture

The layer rules in
[PROJECT_STATUS.md § Current architecture](PROJECT_STATUS.md#current-architecture)
are binding. In particular:

```
Server Component / Server Action  →  service  →  Supabase
```

| Rule                                                                  | Why                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Components never query Supabase directly                              | A query outside `services/` is a query nobody can find later  |
| Services never import React                                           | They must stay callable from webhooks, jobs and scripts       |
| `utils/` never imports env, Supabase or React                         | It is the only folder guaranteed free to import               |
| `types/` emits no runtime code                                        | Importing from it must provably cost zero bytes               |
| `lib/logger.ts` never imports `lib/env.ts`                            | ADR-8 — this exact chain shipped 67 kB of Zod to every client |
| Only `next.config.ts` and `lib/logger.ts` read `process.env` directly | Everything else goes through `lib/env.ts`                     |
| Every URL comes from `lib/routes.ts`                                  | Hard-coded paths drift silently                               |
| `lib/routes.ts` paths carry **no** locale prefix                      | `<Link>` from `@/i18n/navigation` adds it — one concern each  |
| `Link` is imported from `@/i18n/navigation`, never `next/link`        | ESLint-enforced; the wrong one silently resets the locale     |
| No user-facing string is hardcoded in a component                     | § 11 — a literal ships in one language and no tool sees it    |
| Money is integer minor units                                          | ADR-2                                                         |
| RLS before data                                                       | A table never exists without policies, not even briefly       |

**Before reversing an architectural decision, read the ADR table in
`PROJECT_STATUS.md`.** Every ADR has a reason attached. If you still believe the
reversal is right, say so and get agreement — then record the reversal as a new
ADR. Do not silently contradict one.

---

## 5. Keep production quality

- **Server Components by default.** `"use client"` only for interactivity, and
  pushed as far down the tree as possible.
- **No fake data, ever** (ADR-20). No lorem ipsum, no placeholder products, no
  seeded categories. Empty states are where ecommerce UIs actually break, and
  fake data hides them.
- **No dead links.** Do not link to a route whose page does not exist yet.
- **Validate everything crossing a trust boundary.** Server Actions are public
  HTTP endpoints. Use `createAction()`.
- **Fail loudly.** A misconfiguration should break the build, not silently
  degrade in production.
- **Comment the why, not the what.** Explain non-obvious decisions and
  constraints. Do not narrate what the code plainly says.
- **Match the surrounding code** — naming, comment density, file layout.
- Files are `kebab-case.ts`; components are `PascalCase`; hooks are
  `use-thing.ts` exporting `useThing`; imports use the `@/` alias, never `../..`.

### Always verify before reporting done

```bash
npm run check
```

Use `npm run verify` (adds the production build) for anything touching config,
routing or bundling — and always when closing out a phase, where it is step 1 of
the [release policy](#10-release-policy).

Do not report a task complete on the strength of having written the code. If a
check fails, say so and show the output.

---

## 6. Update PROJECT_STATUS.md after every completed task

Not at the end of a phase — after **every** task. Update:

- Progress percentage and phase status
- The relevant status section (database / auth / storefront / admin / security)
- **Next task** — the immediate next step, specific enough to start cold
- Completed work
- Verified metrics, if they changed (bundle size, route count)

An out-of-date `PROJECT_STATUS.md` is worse than no status file, because the
next session will trust it.

---

## 7. Record architectural decisions

Any decision with lasting consequences goes in the ADR table with the **reason**
attached, not just the rule. A future engineer must be able to tell whether the
reason still holds.

Record it when you:

- Choose between two viable approaches
- Introduce or reject a dependency
- Set a constraint others must follow
- Deliberately do something the obvious way would not

Number sequentially, never renumber, never delete. A reversed ADR gets a new
entry pointing back at the one it replaces.

---

## 8. Record technical debt

Anything knowingly deferred goes in the technical debt table with an interest
rate — how fast it gets worse — and the phase that pays it down.

This includes shortcuts you take under time pressure and things left incomplete
because they belong to a later phase. Undocumented debt is indistinguishable
from a bug six months later.

---

## 9. Record known issues

Anything that is wrong, incomplete, or misleading goes in the known issues table
with a severity and a plan — **including latent problems that are not yet
reachable**.

`/admin` is the model here: no admin route exists, so nothing is exploitable
today, but the route table implies protection it does not deliver. That is
documented at the definition in `lib/routes.ts` _and_ in the status file,
because the danger is that a future session trusts the list.

If you discover an issue you are not fixing right now, write it down.

---

## 10. Release policy

**Every completed phase must end with all nine steps below.** Not some of them,
and not in a different order. A phase is not finished until step 9 holds.

| #   | Step                                                        | How                                                                       |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Verify build, lint, typecheck and tests                     | `npm run verify` — see [note on tests](#tests-in-step-1)                  |
| 2   | Update `PROJECT_STATUS.md`                                  | Phase status, progress, next task, known issues, technical debt, ADRs     |
| 3   | Update `CHANGELOG.md`                                       | New version section; move items out of `[Unreleased]`                     |
| 4   | Update `ROADMAP.md` **if needed**                           | Tick completed items; mark the phase complete; correct the estimate       |
| 5   | Commit using Conventional Commits                           | See [format](#conventional-commits) below                                 |
| 6   | Tag the release **when instructed**                         | `git tag -a vX.Y.0 -m "…"` — annotated, never lightweight                 |
| 7   | Push commits and tags                                       | `git push origin main --follow-tags`                                      |
| 8   | Verify the remote matches local                             | `git ls-remote origin` — compare against `git rev-parse HEAD` and the tag |
| 9   | **Never start the next phase until GitHub is synchronised** | `git status` clean **and** `git log origin/main..HEAD` empty              |

Step 6 is the only conditional one: tag only when the user says to. Steps 1–5
and 7–9 are unconditional.

Step 8 means reading the remote, not trusting local cached refs. `origin/main`
is a local pointer and can be stale; `git ls-remote` asks the server.

### Tests in step 1

`npm run verify` runs typecheck, lint, format check and a production build. No
test runner exists yet — the first tests land in Phase 4 (cart maths, tax and
totals), and the `verify` script gains a `npm test` step at that point. Until
then, "tests" in step 1 is satisfied by the build passing. Do not claim tests
ran when none exist.

A build needs `.env.local`; a `verify` that fails on missing environment
variables is a misconfigured machine, not a failing phase.

### Conventional commits

```
<type>(<optional scope>): <subject in the imperative, lowercase, no full stop>

<body: what changed and why — wrap at 72 columns>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

| Type       | Use for                                               |
| ---------- | ----------------------------------------------------- |
| `feat`     | A user-visible capability                             |
| `fix`      | A bug fix                                             |
| `docs`     | Documentation only                                    |
| `refactor` | Behaviour-preserving code change                      |
| `perf`     | A measured performance improvement — quote the number |
| `test`     | Adding or fixing tests                                |
| `build`    | Dependencies, build config, tooling                   |
| `ci`       | CI configuration                                      |
| `chore`    | Anything else that does not touch `app/` behaviour    |

Scope is the phase or the area: `feat(catalog):`, `fix(checkout):`,
`docs(phase-2):`. A phase-closing commit uses the phase as its scope.

Breaking changes get a `!` before the colon and a `BREAKING CHANGE:` footer.
Before v1.0.0 this is informational — the minor version tracks the phase.

---

## 11. Internationalization policy

Bondo is a multilingual application. **Uzbek (default), Russian, English.**
Localization is part of the Definition of Done, not a follow-up task.

### The rules

| Rule                                                                       | Why                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Every user-facing string is translatable — no hardcoded text in components | A literal in a component is invisible to translators and ships in one language   |
| Every new feature ships all three languages                                | A feature is not complete in one; `npm run check` fails if a key is missing      |
| Dates, numbers, prices and currency use locale-aware formatting            | `$1,499.00` and `1 499,00 $` are the same amount; only one is readable to a user |
| Import `Link` and navigation from `@/i18n/navigation`, never `next/link`   | `next/link` compiles, renders, and silently drops the visitor's locale           |
| Every localized page sets its own canonical and `hreflang`                 | An inherited canonical tells crawlers the whole catalog duplicates one URL       |
| UI chrome lives in `messages/`; catalog copy lives on the record           | ADR-39 — different authors, different lifecycles, different storage              |
| Never machine-translate. Write it or have it written                       | A wrong register reads as carelessness in the reader's own language              |

### Where things live

```
i18n/routing.ts       locales, default, URL strategy — shared with middleware
i18n/request.ts       per-request config: messages, time zone, shared formats
i18n/navigation.ts    locale-aware Link, redirect, useRouter, usePathname
i18n/metadata.ts      canonical + hreflang for a route
messages/{uz,ru,en}/  one JSON file per namespace per locale
lib/site-config.ts    the locale table (URL code, BCP 47 tag, native label)
```

### Adding a string

1. Put it in the namespace that matches the feature, in **all three** locales.
2. Read it with `useTranslations("namespace")` — this works in Server _and_
   Client Components, so no component needs a client boundary just to translate.
3. Use ICU for anything with a count: `{n, plural, one {…} other {…}}`. Russian
   needs `few` and `many`; a ternary cannot express its rules.
4. Run `npm run check`. `scripts/check-translations.mjs` fails the build on a
   missing file, a missing key, an empty value, or a placeholder renamed in one
   language.

### Adding a locale

Add it to `locales` and `localeConfig` in `lib/site-config.ts`, create
`messages/<code>/` with every namespace, and add the locale's script to the font
subsets in `app/[locale]/layout.tsx`. Nothing else hardcodes the list — routing,
`hreflang`, the switcher and the checker all derive from it.

---

## Commands

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build
npm run check        # typecheck + lint + format + translations — before every commit
npm run i18n:check   # translation parity across uz/ru/en on its own
npm run verify       # check + build — step 1 of the release policy
npm run db:start     # local Supabase stack (requires Docker)
npm run db:reset     # drop and replay all migrations locally
npm run db:types     # regenerate types/database.ts from the local database
```

After **any** schema change, regenerate types and commit them.
`types/database.ts` is generated output — never hand-edit it.

---

## Current state

**Phase 1 (Foundation) is complete.** Phase 2 (Database & Authorization) is
next. Do not begin it without the user's go-ahead.

The next task is written out step by step in
[PROJECT_STATUS.md § Next task](PROJECT_STATUS.md#next-task).
