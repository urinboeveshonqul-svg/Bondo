import {
  BadgeCheck,
  Banknote,
  Boxes,
  CircleDot,
  ClipboardCheck,
  Cpu,
  CreditCard,
  Headphones,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The icons a service highlight may use.
 *
 * `service_highlights.icon` stores a name, and this is the set of names that
 * resolve. An explicit map rather than a lookup into the lucide barrel:
 * `optimizePackageImports` can only tree-shake what it can see statically, and
 * `icons[name]` would pull all ~1,500 glyphs into the bundle.
 *
 * It is exported because the admin's icon picker renders from it — one list, so
 * an operator cannot pick a glyph the storefront would fail to draw. Extending
 * the set is a change here and nowhere else; deliberately **not** a database
 * enum, which would make adding a glyph a migration.
 */
export const HIGHLIGHT_ICONS: Record<string, LucideIcon> = {
  ShieldCheck,
  BadgeCheck,
  ClipboardCheck,
  PackageCheck,
  Package,
  Boxes,
  Truck,
  MapPin,
  Timer,
  Wrench,
  Cpu,
  Headphones,
  Phone,
  RotateCcw,
  CreditCard,
  Banknote,
  Sparkles,
};

export const HIGHLIGHT_ICON_NAMES = Object.keys(HIGHLIGHT_ICONS);

export function HighlightIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  // An unknown name means the row predates a rename, or somebody typed it. A
  // neutral glyph keeps the card's layout intact; rendering nothing would leave
  // a hole that is harder to notice than a wrong icon.
  const Icon = HIGHLIGHT_ICONS[name] ?? CircleDot;

  return <Icon className={cn("size-5", className)} aria-hidden="true" />;
}
