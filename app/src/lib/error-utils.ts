/**
 * Extract a user-facing error message from an unknown error.
 */
export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong"
): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

/**
 * Log an error with context.
 */
export function logError(context: string, err: unknown): void {
  console.error(`${context}:`, err);
}

/** Common user-facing error messages */
export const ERROR_MESSAGES = {
  SAVE_ACTIVITY: "Failed to save activity. Please try again.",
  SAVE_GROUP: "Failed to save group. Please try again.",
  SAVE_SESSION: "Failed to save session. Please try again.",
  SYNC: "Unknown sync error",
  IMPORT: "Import failed",
} as const;
