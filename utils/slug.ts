/**
 * URL slug helpers.
 *
 * Product and category URLs are slug-based for SEO. Slugs are generated once
 * and persisted alongside the row — never derived on read, or renaming a
 * product would silently break every existing link.
 */

export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      // Strip combining diacritical marks so "Résumé" becomes "resume".
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
