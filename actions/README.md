# Server Actions

Mutation entry points called from the UI. One file per domain, each starting
with `"use server"`.

A Server Action compiles to a public HTTP endpoint. Anything reachable from the
client can be invoked directly with arbitrary input, so each action must:

1. **Validate input with Zod** — the form's own validation proves nothing.
2. **Authorise the caller** — `getCurrentUser()` from `supabase/server.ts`, plus
   an ownership check. RLS is the backstop, not the only gate.
3. **Delegate to a service** — actions orchestrate, they do not write queries.
4. **Revalidate** — `revalidatePath` / `revalidateTag` after a successful write.
5. **Return a `Result`** — never throw across the network boundary.

`createAction()` in `safe-action.ts` enforces 1 and 5, and rethrows Next.js
control-flow signals so `redirect()` still works inside a handler:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/actions/safe-action";
import { createClient, getCurrentUser } from "@/supabase/server";
import { AppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import * as cartService from "@/services/cart.service";

export const addToCart = createAction(
  "addToCart",
  z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(99) }),
  async (input) => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("unauthorized", "Please sign in first.");

    const supabase = await createClient();
    const cart = await cartService.addItem(supabase, user.id, input);

    revalidatePath(routes.cart);
    return cart;
  },
);
```

Actions are added in Phase 3, alongside the features that call them.
