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

Then `npm run build` for anything touching config, routing or bundling. Do not
report a task complete on the strength of having written the code. If a check
fails, say so and show the output.

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

## Commands

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build
npm run check        # typecheck + lint + format check — run before every commit
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
