-- =============================================================================
-- Storage buckets and object policies
-- =============================================================================
-- Created in SQL rather than declared in config.toml so that the same
-- definition applies to the local stack and to every hosted environment. A
-- bucket that exists locally but not in production is a class of bug that only
-- appears after deploy.
--
-- Bucket-by-bucket reasoning:
--
--   products, brands, banners, site-assets   public read
--       These are rendered by next/image on anonymous pages. A private bucket
--       would require a signed URL per image per request, which defeats CDN
--       caching and would put a Supabase round trip in front of every product
--       photo. `next.config.ts` already restricts the image optimiser to this
--       project's storage host, so the exposure is "our own public catalog
--       imagery is public", which is the intent.
--
--   avatars                                  private
--       User-uploaded photographs of people. Served through a signed URL. The
--       asymmetry is deliberate: catalog imagery is marketing, an avatar is
--       personal data.
--
-- Write access everywhere is permission-gated through the same has_permission()
-- used by table policies, so revoking a role revokes storage writes with it.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'products', 'products', true,
    10485760,  -- 10 MiB: enough for a high-resolution product photograph
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'brands', 'brands', true,
    2097152,   -- 2 MiB: logos, frequently SVG
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
  ),
  (
    'avatars', 'avatars', false,
    2097152,   -- 2 MiB: downscaled client-side before upload
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'banners', 'banners', true,
    10485760,  -- 10 MiB: full-width hero imagery
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'site-assets', 'site-assets', true,
    5242880,   -- 5 MiB: favicons, og images, small documents
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'application/pdf']
  )
on conflict (id) do nothing;

-- MIME allow-lists above are enforced by Storage on upload. They matter: an
-- unrestricted public bucket accepting text/html turns the project's storage
-- domain into a host for arbitrary pages.

-- -----------------------------------------------------------------------------
-- Object policies
-- -----------------------------------------------------------------------------
-- RLS on storage.objects is already enabled by Supabase; policies are added,
-- not the table's RLS state.

-- --- public catalog buckets ----------------------------------------------------
create policy "storage: anyone reads public catalog buckets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('products', 'brands', 'banners', 'site-assets'));

create policy "storage: products.update writes product images"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'products' and public.has_permission('products.update'))
  with check (bucket_id = 'products' and public.has_permission('products.update'));

create policy "storage: brands.manage writes brand logos"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'brands' and public.has_permission('brands.manage'))
  with check (bucket_id = 'brands' and public.has_permission('brands.manage'));

create policy "storage: banners.manage writes banner images"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'banners' and public.has_permission('banners.manage'))
  with check (bucket_id = 'banners' and public.has_permission('banners.manage'));

create policy "storage: settings.update writes site assets"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'site-assets' and public.has_permission('settings.update'))
  with check (bucket_id = 'site-assets' and public.has_permission('settings.update'));

-- --- avatars -------------------------------------------------------------------
-- Objects are stored under `<user-id>/<filename>`, so the first path segment is
-- the owner. Comparing it to auth.uid() means a user can only reach their own
-- folder — without this, any authenticated user could enumerate every avatar.
-- storage.foldername() returns the path segments; [1] is the first.
create policy "storage: owner reads own avatar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage: owner writes own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage: owner replaces own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage: owner deletes own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Support needs to see a customer's avatar when resolving an impersonation or
-- abuse report. Gated on users.read, the same permission that reads the profile
-- the avatar belongs to.
create policy "storage: users.read reads any avatar"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and public.has_permission('users.read'));
