"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
} from "lucide-react";

import {
  deleteProductImage,
  reorderProductImages,
  setPrimaryProductImage,
  uploadProductImage,
} from "@/actions/catalog.actions";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminProductImage } from "@/types/admin";

/**
 * The product gallery: upload, preview, reorder, choose the primary, remove.
 *
 * ## Every action writes immediately
 *
 * Unlike the rest of the editor, which batches into one Save, each control here
 * is its own mutation. A gallery is a set of rows in `product_images`, not
 * fields on the product — there is no "save the form" step that would commit
 * them, and a picture that vanishes because the operator pressed Escape instead
 * of Save is the behaviour this component exists to prevent.
 *
 * That is also why it does **not** hold a client-side copy of the list. Every
 * action revalidates and the server sends the gallery back, so what is on screen
 * is what is in the database — the same stance the categories manager takes.
 *
 * ## It needs a saved product
 *
 * The storage key is prefixed with the product id, and `product_images.product_id`
 * is `not null`. A product that has never been saved has neither, so the control
 * says so rather than rendering a disabled button with no explanation. This is
 * the one ordering constraint the editor imposes, and it is the schema's.
 *
 * ## Primary
 *
 * The first upload becomes primary automatically — `uploadProductImage` in the
 * service does that, because a product with images and no primary renders no
 * thumbnail anywhere. A partial unique index enforces "at most one" underneath.
 */
export function ProductImages({
  productId,
  images,
  disabled = false,
}: {
  /** `null` for a product that has not been created yet. */
  productId: string | null;
  images: readonly AdminProductImage[];
  disabled?: boolean;
}) {
  const t = useTranslations("adminCatalog.editor.images");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const locked = disabled || pending || !productId;

  /** Every control funnels through here, so none of them can fake a success. */
  function run(
    work: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success?: string,
  ) {
    startTransition(async () => {
      const result = await work();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (success) toast.success(success);
      router.refresh();
    });
  }

  function upload(file: File) {
    if (!productId) return;

    run(
      () => uploadProductImage({ productId, file, altText: null }),
      t("uploaded"),
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (!productId || target < 0 || target >= images.length) return;

    const next = [...images];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);

    run(() =>
      reorderProductImages({
        productId,
        orderedIds: next.map((image) => image.id),
      }),
    );
  }

  return (
    <div className="space-y-3">
      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {productId ? t("emptyDescription") : t("needsSave")}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className={cn(
                "space-y-2 rounded-lg border p-2",
                image.isPrimary && "border-primary",
              )}
            >
              {/*
                `unoptimized`: an admin thumbnail of a file uploaded seconds ago
                does not need a transform spent on it, and the optimiser would
                cache a URL that is about to be deleted as often as not.
              */}
              <Image
                src={image.url}
                alt={image.altText}
                width={240}
                height={180}
                unoptimized
                className="aspect-4/3 w-full rounded-md object-cover"
              />

              <div className="flex items-center justify-between gap-1">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {image.isPrimary ? t("primary") : `#${index + 1}`}
                </span>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={locked || index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`${t("moveEarlier")} — ${index + 1}`}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={locked || index === images.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`${t("moveLater")} — ${index + 1}`}
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={locked || image.isPrimary}
                    onClick={() =>
                      productId &&
                      run(
                        () =>
                          setPrimaryProductImage({
                            productId,
                            imageId: image.id,
                          }),
                        t("primarySet"),
                      )
                    }
                    aria-label={`${t("setPrimary")} — ${index + 1}`}
                  >
                    <Star className={cn(image.isPrimary && "fill-current")} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={locked}
                    onClick={() =>
                      productId &&
                      run(
                        () =>
                          deleteProductImage({ productId, imageId: image.id }),
                        t("removed"),
                      )
                    }
                    aria-label={`${t("remove")} — ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        accept="image/webp,image/avif,image/jpeg,image/png"
        className="sr-only"
        disabled={locked}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset first: choosing the same file twice must re-fire `change`, and
          // it does not while the input still holds it.
          event.target.value = "";
          if (file) upload(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={() => input.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          {t("add")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {productId ? t("hint") : t("needsSave")}
        </p>
      </div>
    </div>
  );
}
