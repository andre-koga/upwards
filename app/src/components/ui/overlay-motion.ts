/**
 * Shared overlay motion contract. Keep durations in state-scoped utilities so
 * they override tailwindcss-animate's default animation duration.
 */
export const overlayBackdropMotionClassName =
  "[animation-timing-function:ease-out] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:[animation-duration:150ms] data-[state=open]:[animation-duration:180ms] motion-reduce:animate-none motion-reduce:transition-none";

export const dialogSurfaceMotionClassName =
  "[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:[animation-duration:150ms] data-[state=open]:[animation-duration:200ms] motion-reduce:animate-none motion-reduce:transition-none";

export const sheetSurfaceMotionClassName =
  "[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[animation-duration:220ms] data-[state=open]:[animation-duration:260ms] motion-reduce:animate-none motion-reduce:transition-none";
