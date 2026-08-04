import type { ModuleStatusTone } from "@/components/admin/module/module-status-badge";
import type { publishState } from "@/utils/admin";

/**
 * Publish state → badge tone.
 *
 * One map, imported by the list and by the editor, because the same product
 * showing a grey badge in the table and a blue one in the form is the kind of
 * inconsistency that makes an operator doubt which screen is telling the truth.
 *
 * `archived` and `hidden` share the muted tone deliberately: both mean "nobody
 * can see this", and the badge's *word* is what distinguishes why.
 */
export const STATE_TONE: Record<
  ReturnType<typeof publishState>,
  ModuleStatusTone
> = {
  active: "success",
  draft: "neutral",
  archived: "muted",
  hidden: "muted",
  scheduled: "info",
};
