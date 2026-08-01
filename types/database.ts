/**
 * Supabase database types.
 *
 * THIS FILE IS GENERATED — do not edit it by hand. Regenerate after every
 * migration:
 *
 *   npm run db:types          # against the local stack
 *   npm run db:types:remote   # against the linked hosted project
 *
 * ⚠️  STALE AS OF PHASE 2. The schema below is the empty-schema shape, but
 * `supabase/migrations/` now defines 18 tables. This file was NOT regenerated
 * because `supabase gen types` runs its generator inside a container and the
 * machine Phase 2 was built on has no Docker and no linked project — every mode
 * of the command (`--local`, `--linked`, `--db-url`) needs one.
 *
 * It was deliberately left stale rather than hand-written. `Tables` being
 * `Record<never, never>` means `supabase.from("products")` is a compile error,
 * so the mistake surfaces at build time instead of becoming a set of plausible
 * but subtly wrong types nobody checks. Hand-authoring it would also break the
 * project's own rule that these types are generated output.
 *
 * **Run `npm run db:types` before writing any query.** Tracked as K-3.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

/** Row type for a table or view, e.g. `Tables<"products">`. */
export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R }
    ? R
    : never;

/** Insert payload for a table, e.g. `TablesInsert<"products">`. */
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never;

/** Update payload for a table, e.g. `TablesUpdate<"products">`. */
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never;

/** Postgres enum union, e.g. `Enums<"order_status">`. */
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
