/**
 * Supabase database types.
 *
 * THIS FILE IS GENERATED — do not edit it by hand. Regenerate after every
 * migration:
 *
 *   npm run db:types          # against the local stack
 *   npm run db:types:remote   # against the linked hosted project
 *
 * The schema is empty until the first migration lands in Phase 2, so the shape
 * below is the empty-schema output the generator produces. It exists so that
 * `createClient<Database>()` is typed from day one and every table added later
 * flows through the same import.
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
