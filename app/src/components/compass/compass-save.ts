import { CompassError } from "@/lib/compass/compass";
import { logError } from "@/lib/error-utils";

/** A code the compass copy can show, or "save" for anything unexpected. */
export function compassErrorCode(error: unknown): string {
  if (error instanceof CompassError) return error.code;
  logError("Compass save failed", error);
  return "save";
}
