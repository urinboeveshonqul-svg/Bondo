# Mock catalog data — TEMPORARY

Everything in this folder exists to build and review the storefront interface
before it is wired to Supabase, and is **deleted** when services land.

## Why this exists at all

**ADR-20 forbids fake data**, and the reasoning still holds: placeholder content
hides empty states, and empty states are where ecommerce UIs break. The Phase 3A
brief overrides it for the interface layer only, and **ADR-36** records that
override with its limits.

Three rules keep the override from becoming permanent damage:

1. **Nothing here is imported by `services/`, `actions/` or `lib/`.** Only
   `app/` and `components/` read it, so deleting this folder produces compile
   errors in exactly the places that must change.
2. **The shapes are `types/catalog.ts`, not invented per-component.** Services
   will map `Tables<"products">` onto the same types, so components do not
   change when the source does.
3. **Empty and error states are built and reachable anyway.** They are rendered
   from real conditions — an empty cart, an empty wishlist, a filter that
   matches nothing — not simulated with a flag. The failure mode ADR-20 warns
   about is designed around rather than deferred.

## What is deliberately not faked

- **No lorem ipsum.** Every string is real product prose or real copy.
- **No invented brands.** NVIDIA, AMD, Intel, Corsair, Lenovo, ASUS and Razer
  are the manufacturers this store would actually stock, and match the brands
  seeded in `supabase/seed.sql`.
- **No product photography.** Products render a generated monogram tile rather
  than a stock photo, because a fake photograph of a real product is the one
  piece of mock data a reviewer could mistake for finished work.

## Removing it

When `services/products.service.ts` exists:

```
1. Point the pages at the service instead of `mocks/catalog`.
2. Delete this folder.
3. `npm run check` — every remaining reference is now a compile error.
4. Delete ADR-36's exemption note and close D-11.
```
