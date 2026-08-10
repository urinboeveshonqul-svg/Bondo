import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProductDetail } from "@/services/products.service";
import { BUCKETS, publicUrl } from "@/services/storage.service";
import type { AdminProductDraft } from "@/types/admin";
import type { Database } from "@/types/database";

/**
 * Maps a database product onto what the editor holds.
 *
 * One projection, used by the edit page and by nothing else yet — but it lives
 * here rather than inside the page because it is the seam between the service's
 * shape and the form's, and a second caller (a duplicate action, a bulk editor)
 * should not be tempted to re-derive it.
 *
 * The only non-trivial part is the gallery: `product_images` stores a Storage
 * **key**, and an `<img>` needs a URL. Resolving it here means the client
 * component never constructs a Supabase client to render a picture.
 */
export function toProductDraft(
  supabase: SupabaseClient<Database>,
  product: ProductDetail,
): AdminProductDraft {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    brandId: product.brand?.id ?? null,
    categoryId: product.categoryId,
    priceCents: product.priceCents,
    salePriceCents: product.salePriceCents,
    warrantyMonths: product.warrantyMonths,
    status: product.status,
    visibility: product.visibility,
    isFeatured: product.isFeatured,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    seoKeywords: [...product.seoKeywords],
    specifications: [...product.specifications]
      .sort((a, b) => a.display_order - b.display_order)
      .map((spec) => ({
        group: spec.spec_group,
        name: spec.name,
        value: spec.value,
        unit: spec.unit,
      })),
    images: [...product.images]
      .sort((a, b) => a.display_order - b.display_order)
      .map((image) => ({
        id: image.id,
        path: image.storage_path,
        url: publicUrl(supabase, BUCKETS.products, image.storage_path),
        altText: image.alt_text ?? "",
        isPrimary: image.is_primary,
      })),
    publishedAt: product.publishedAt,
    updatedAt: product.updatedAt,
    deletedAt: product.deletedAt,
  };
}
