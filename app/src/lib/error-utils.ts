import { db, newId, now } from "@/lib/db";

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
 * Log an error with context and store it in the database.
 */
export function logError(context: string, err: unknown): void {
  const message = getErrorMessage(err);
  console.error(`${context}:`, err);
  
  // Store in database
  void (async () => {
    try {
      await db.appLogs.add({
        id: newId(),
        level: "error",
        context,
        message,
        created_at: now(),
      });
    } catch (e) {
      console.error("Failed to store error log:", e);
    }
  })();
}

/**
 * Log a success message.
 */
export function logSuccess(context: string, message: string): void {
  console.log(`${context}: ${message}`);
  
  void (async () => {
    try {
      await db.appLogs.add({
        id: newId(),
        level: "success",
        context,
        message,
        created_at: now(),
      });
    } catch (e) {
      console.error("Failed to store success log:", e);
    }
  })();
}

/**
 * Log an info message.
 */
export function logInfo(context: string, message: string): void {
  console.log(`${context}: ${message}`);
  
  void (async () => {
    try {
      await db.appLogs.add({
        id: newId(),
        level: "info",
        context,
        message,
        created_at: now(),
      });
    } catch (e) {
      console.error("Failed to store info log:", e);
    }
  })();
}

/** Common user-facing error messages */
export const ERROR_MESSAGES = {
  SAVE_ACTIVITY: "Failed to save activity. Please try again.",
  SAVE_GROUP: "Failed to save group. Please try again.",
  SAVE_SESSION: "Failed to save session. Please try again.",
  SYNC: "Unknown sync error",
  IMPORT: "Import failed",
} as const;
