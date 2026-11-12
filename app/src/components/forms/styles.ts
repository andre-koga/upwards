/**
 * Every form control in a dialog shares one shape: a soft tonal field, 44px
 * tall, no border. Text inputs, time pickers, selects and action buttons must
 * read as the same object, so they all start from `controlBase`.
 *
 * Type is 16px, and only the size changes: an arbitrary value keeps the
 * existing line-height. iOS Safari zooms the page when a focused text field
 * is any smaller, and the page stays zoomed after the field blurs.
 */
const controlBase =
  "h-11 w-full rounded-xl border border-transparent bg-muted/70 px-3.5 text-[16px] font-normal text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground";

/**
 * A read-only value (a running session's end, a completion with no span) keeps
 * the same height and shape, drops the fill and gets a hairline instead, so it
 * looks set rather than editable.
 */
const readOnlyControl =
  "read-only:cursor-default read-only:border-border read-only:bg-transparent read-only:text-muted-foreground read-only:focus-visible:ring-0";

export const dialogFieldClassName = `${controlBase} py-2 ${readOnlyControl}`;

export const dialogTextareaClassName = `${controlBase} ${readOnlyControl} h-auto min-h-[5.5rem] resize-none py-2.5 leading-relaxed`;

export const dialogSelectTriggerClassName = `${controlBase} hover:bg-muted data-[disabled]:cursor-default data-[disabled]:bg-transparent data-[disabled]:border-border data-[disabled]:text-muted-foreground`;

export const dialogActionContainerClassName = "flex items-center gap-2 pt-3";

export const dialogPrimaryActionClassName =
  "h-11 flex-1 rounded-full px-5 text-[0.9375rem] font-semibold shadow-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export const dialogSecondaryActionClassName =
  "h-11 flex-1 rounded-full bg-muted/70 px-5 text-[0.9375rem] font-medium shadow-none hover:bg-muted";

export const dialogSecondaryDestructiveClassName = "hover:text-destructive";

/** Primary confirm action in a destructive dialog (delete permanently, etc.). */
export const dialogPrimaryDestructiveClassName =
  "bg-destructive text-destructive-foreground shadow-none hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive";

export const dialogFieldLabelClassName =
  "text-[0.8125rem] font-medium text-muted-foreground";

/** Action control in a dialog form: same shape as every other field. */
export const dialogFormControlButtonClassName = `${controlBase} flex items-center justify-start gap-2 hover:bg-muted [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground`;
