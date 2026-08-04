#!/usr/bin/env node
/**
 * Serves the migrated schema over the Postgres wire protocol.
 *
 * This is what lets `supabase gen types typescript --db-url …` run without
 * Docker: the official generator connects over TCP and introspects
 * `pg_catalog`, exactly as it would against a real database. The types are
 * therefore *generated output* from the real migrations — not hand-written,
 * which the project forbids.
 *
 * Prints READY on stdout once listening, so a caller can wait for it rather
 * than sleeping.
 */
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

import { createSchema } from "./db-harness.mjs";

const PORT = Number(process.env.PGLITE_PORT ?? 5433);

const { db, migrationCount } = await createSchema();

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
await server.start();

console.log(`READY port=${PORT} migrations=${migrationCount}`);

async function shutdown() {
  await server.stop();
  await db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
