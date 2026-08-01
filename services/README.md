# Services

The data-access layer. **Every** read and write to Supabase goes through a
service — no component, page, or Server Action queries the database directly.

## Why the layer exists

- One place per domain owns its queries, so a schema change has one blast radius.
- Authorisation and validation live next to the query instead of being repeated
  at every call site.
- Services return domain objects, not raw Postgres rows, so the UI never depends
  on column names.
- Supabase can be swapped or a query moved to an RPC without touching the UI.

## Shape

One file per aggregate, named `<domain>.service.ts`:

```
services/
  products.service.ts
  categories.service.ts
  cart.service.ts
  orders.service.ts
```

Each file exports plain async functions. Rules:

1. **Take a Supabase client as input** rather than creating one. The caller
   decides whether the query runs as the user (`supabase/server.ts`, RLS
   enforced) or as the service role (`supabase/admin.ts`, RLS bypassed).
2. **Throw `AppError`** from `lib/errors.ts` on failure. Never return a bare
   Postgres error — it leaks schema details.
3. **No React imports.** Services must stay callable from Route Handlers,
   webhooks and scripts, not just components.
4. **No caching decisions.** `unstable_cache` / `revalidateTag` belong to the
   caller, which knows the request context.

```ts
// services/products.service.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import type { Database, Tables } from "@/types/database";

export async function getProductBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<Tables<"products">> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error)
    throw new AppError("not_found", "Product not found", { cause: error });
  return data;
}
```

Services are added in Phase 2, once the schema and its RLS policies exist.
