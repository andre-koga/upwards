/**
 * SRP: Defines shared dialog-form style tokens for form composition components.
 */

export const dialogFieldClassName =
  "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary read-only:cursor-default read-only:border-border read-only:border-dashed disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted/30";

export const dialogTextareaClassName = `${dialogFieldClassName} resize-none`;

export const dialogSelectTriggerClassName =
  "h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary data-[disabled]:border-dashed data-[disabled]:border-dashed data-[disabled]:cursor-default data-[disabled]:opacity-100 data-[disabled]:bg-muted/30";

export const dialogActionContainerClassName =
  "flex items-center justify-center gap-3 pt-2";

export const dialogPrimaryActionClassName =
  "w-full max-w-[12rem] rounded-full px-5 py-2.5 text-sm font-semibold shadow-md disabled:cursor-not-allowed disabled:opacity-40";

export const dialogSecondaryActionClassName =
  "rounded-full px-5 py-2.5 text-sm font-semibold shadow-md";

export const dialogSecondaryDestructiveClassName = "hover:text-destructive";

export const dialogFieldLabelClassName = "text-xs";
