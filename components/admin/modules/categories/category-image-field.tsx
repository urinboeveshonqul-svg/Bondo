"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";

import { uploadCategoryImage } from "@/actions/catalog.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * The category image: upload, preview, remove.
 *
 * The **first** upload control in the admin that actually reaches Storage.
 * `ModuleMediaManager` has existed since Phase 3D and uploads nothing (D-12);
 * this does not replace it — a category has one image, not a gallery, and the
 * manager's reorder, alt-text and primary-image machinery would be a gallery
 * pretending to hold a single file.
 *
 * ## Uploading does not save
 *
 * The action returns a storage path and a URL; the path goes into the form's
 * draft and the operator's Save is what writes `image_path`. So uploading and
 * then navigating away leaves the category exactly as it was.
 *
 * The cost is an orphaned object in the bucket — a few kilobytes. The
 * alternative writes to a live category the moment a file is chosen, which means
 * a mis-picked image is on the storefront before the operator has agreed to
 * anything. Storage waste is the cheaper mistake.
 *
 * ## A new category cannot upload yet
 *
 * The storage key is prefixed with the category id, which a category that has
 * never been saved does not have. Rather than inventing one and reconciling it
 * later, the control says so and asks for a save first — one sentence the
 * operator can act on, instead of a disabled button with no explanation.
 */
export function CategoryImageField({
  categoryId,
  path,
  url,
  onChange,
  disabled = false,
}: {
  /** Empty for a category that has not been saved yet. */
  categoryId: string;
  path: string | null;
  /** The public URL for `path`, resolved server-side. */
  url: string;
  onChange: (next: { path: string | null; url: string }) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("adminCatalog.categories");
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  /** A just-uploaded image has no server-rendered URL yet, so keep it here. */
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const preview = localUrl ?? (path ? url : null);

  function upload(file: File) {
    startTransition(async () => {
      // A `File` survives the Server Action boundary — Next.js serialises it
      // over the same multipart channel a form submission uses — so this stays
      // the plain-object call every other action in the module makes.
      const result = await uploadCategoryImage({ categoryId, file });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setLocalUrl(result.data.url);
      onChange({ path: result.data.path, url: result.data.url });
    });
  }

  return (
    <div className="space-y-2">
      <Label>{t("fields.image")}</Label>

      <div className="flex flex-wrap items-start gap-3">
        {preview ? (
          // `unoptimized`, deliberately: this is a 160px admin thumbnail of a
          // file uploaded seconds ago, and running it through the optimiser
          // would spend a transform on an image only the operator ever sees.
          // `alt=""` because the field's own label already names it.
          <Image
            src={preview}
            alt=""
            width={160}
            height={96}
            unoptimized
            className="h-24 w-40 rounded-lg border object-cover"
          />
        ) : (
          <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <ImagePlus className="size-5" aria-hidden="true" />
          </div>
        )}

        <div className="space-y-2">
          <input
            ref={input}
            type="file"
            accept="image/webp,image/avif,image/jpeg,image/png"
            className="sr-only"
            disabled={disabled || pending || !categoryId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset first: picking the same file twice must re-fire `change`,
              // and it does not while the input still holds it.
              event.target.value = "";
              if (file) upload(file);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || pending || !categoryId}
              onClick={() => input.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              {path ? t("fields.replaceImage") : t("fields.uploadImage")}
            </Button>

            {path ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || pending}
                onClick={() => {
                  setLocalUrl(null);
                  onChange({ path: null, url: "" });
                }}
              >
                <Trash2 aria-hidden="true" />
                {t("fields.removeImage")}
              </Button>
            ) : null}
          </div>

          <p className="max-w-xs text-xs text-muted-foreground">
            {categoryId ? t("fields.imageHint") : t("fields.imageNeedsSave")}
          </p>
        </div>
      </div>
    </div>
  );
}
