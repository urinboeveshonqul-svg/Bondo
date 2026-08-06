import {
  AppWindow,
  Armchair,
  Boxes,
  Cable,
  CircleDot,
  Computer,
  Cpu,
  Disc,
  Fan,
  Gamepad2,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  MemoryStick,
  Monitor,
  Mouse,
  Package,
  PcCase,
  Plug,
  Printer,
  Router,
  ScanLine,
  Server,
  ShieldCheck,
  Speaker,
  Usb,
  Webcam,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The icons a category may use.
 *
 * `categories.icon` stores a name, and this is the set of names that resolve.
 * An explicit map rather than a lookup into the lucide barrel:
 * `optimizePackageImports` can only tree-shake what it can see statically, and
 * `icons[name]` would pull all ~1,500 glyphs into the bundle — on the header,
 * which is on every page.
 *
 * It is exported because the admin's icon picker renders from it. One list, so
 * an operator cannot pick a glyph the storefront would fail to draw, and the
 * Server Action validates membership against this same array (ADR-69, applied
 * to categories by ADR-72). Extending the set is a change here and nowhere else;
 * deliberately **not** a database enum, which would make adding a glyph a
 * migration.
 *
 * The set is chosen for what this shop sells rather than being general-purpose:
 * every one of the twelve departments has a glyph a shopper would recognise
 * before reading the label.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  PcCase,
  Laptop,
  Computer,
  Monitor,
  Cpu,
  MemoryStick,
  HardDrive,
  Fan,
  Plug,
  Zap,
  Gamepad2,
  Armchair,
  Keyboard,
  Mouse,
  Headphones,
  Speaker,
  Webcam,
  Usb,
  Cable,
  Wifi,
  Router,
  Server,
  Printer,
  ScanLine,
  Disc,
  AppWindow,
  ShieldCheck,
  Boxes,
  Package,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

/**
 * Draws a category's icon, or nothing when it has none.
 *
 * A category without an icon is normal — the ninety subcategories ship without
 * one, because a menu column of ninety identical glyphs is noise. Returning
 * `null` lets the caller lay out with and without, rather than reserving space
 * for something that is not there.
 *
 * An unknown *name*, by contrast, means the row predates a rename or somebody
 * typed it, and that gets the neutral glyph: it keeps the row's alignment and
 * is easier to notice than a hole.
 */
export function CategoryIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  if (!name) return null;

  const Icon = CATEGORY_ICONS[name] ?? CircleDot;

  return <Icon className={cn("size-5", className)} aria-hidden="true" />;
}
