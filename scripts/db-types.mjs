#!/usr/bin/env node
/**
 * Generates `types/database.ts` from the migrations, without Docker.
 *
 * `supabase gen types` runs its generator inside a container even when handed a
 * `--db-url`, and this machine has no container runtime (**K-3**). So this
 * script does what that container does, with the same code:
 * `@supabase/postgres-meta` is the package the container runs, and
 * `getGeneratorMetadata` + the TypeScript template are the exact two calls its
 * `/generators/typescript` route makes — see
 * `node_modules/@supabase/postgres-meta/dist/server/routes/generators/typescript.js`.
 *
 * The database it introspects is PGlite with every migration applied
 * (`db-harness.mjs`), served over the Postgres wire protocol. So the output is
 * **generated from the real SQL by the official generator** — it is not
 * hand-written, which the project forbids and which would produce plausible,
 * subtly wrong types nobody checks.
 *
 * Provenance caveat, stated in the emitted header: this reflects the migrations
 * in this repository, not a live Supabase project. For the `public` schema those
 * are the same thing, because `public` is defined entirely by that SQL. It does
 * **not** cover drift introduced outside migrations, which is a reason to
 * re-run `db:types:remote` once a project is linked.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PostgresMeta } from "@supabase/postgres-meta";
import { getGeneratorMetadata } from "@supabase/postgres-meta/dist/lib/generators.js";
import { apply as applyTypescriptTemplate } from "@supabase/postgres-meta/dist/server/templates/typescript.js";

import { createSchema } from "./db-harness.mjs";

const OUT = fileURLToPath(new URL("../types/database.ts", import.meta.url));
const PORT = Number(process.env.PGLITE_PORT ?? 5434);

const HEADER = `/**
 * Supabase database types.
 *
 * THIS FILE IS GENERATED — do not edit it by hand.
 *
 *   npm run db:types          # from supabase/migrations via PGlite (no Docker)
 *   npm run db:types:remote   # from the linked hosted project
 *
 * Produced by \`@supabase/postgres-meta\` — the same generator the Supabase CLI
 * runs inside its container — introspecting a PGlite database with every
 * migration in \`supabase/migrations/\` applied. See \`scripts/db-types.mjs\`.
 *
 * It therefore describes **the migrations in this repository**, which for the
 * \`public\` schema is the whole definition. It cannot see drift applied to a
 * hosted project outside migrations: re-run \`db:types:remote\` once a project is
 * linked, and treat a diff as a schema that has drifted.
 */

`;

const { db, migrationCount } = await createSchema();

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
await server.start();

try {
  const pgMeta = new PostgresMeta({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
    max: 1,
  });

  const { data: metadata, error } = await getGeneratorMetadata(pgMeta, {
    includedSchemas: ["public"],
    excludedSchemas: [],
  });

  if (error) throw new Error(`Introspection failed: ${error.message}`);

  // The route returns this straight to fastify, which awaits it — so it is a
  // promise, not a string.
  const generated = await applyTypescriptTemplate({
    ...metadata,
    detectOneToOneRelationships: true,
  });

  await writeFile(OUT, HEADER + String(generated).trimStart(), "utf8");

  const tableCount = (metadata.tables ?? []).filter(
    (table) => table.schema === "public",
  ).length;

  console.log(
    `types/database.ts generated — ${tableCount} tables from ${migrationCount} migrations`,
  );

  await pgMeta.end();
} finally {
  await server.stop();
  await db.close();
}
