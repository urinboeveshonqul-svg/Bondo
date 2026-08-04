import {
  Boxes,
  CircleDot,
  FileText,
  FolderTree,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  ScrollText,
  Settings,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Resolves the icon *names* carried by `lib/admin/navigation.ts`.
 *
 * The nav tree is plain data — it is imported by the sidebar, the command
 * palette and the breadcrumbs, and it has to stay free of React so it can also
 * be imported by anything that is not a component. Names are the serialisable
 * way to express "this item looks like a box".
 *
 * An explicit map, not a dynamic lookup into the lucide barrel: `optimizePackageImports`
 * can only tree-shake imports it can see statically. `icons[name]` would pull all
 * ~1,500 glyphs into the bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  Boxes,
  LayoutTemplate,
  FileText,
  Users,
  ScrollText,
  Settings,
};

export function NavIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  // A missing name is a typo in the nav tree, not a reason to render nothing —
  // a blank space beside a label is harder to notice than a wrong glyph.
  const Icon = ICONS[name] ?? CircleDot;

  return (
    <Icon className={cn("size-4 shrink-0", className)} aria-hidden="true" />
  );
}
