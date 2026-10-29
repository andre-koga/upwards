/** The phone column on a wide window. Overlays portal here so they stay inside it. */
export const MOBILE_FRAME_ID = "mobile-frame";

export function mobileFrame(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.getElementById(MOBILE_FRAME_ID) ?? undefined;
}
