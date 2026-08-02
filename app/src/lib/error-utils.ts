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
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

/**
 * True for common abort / background-tab / brief-connectivity failures.
 * These happen when the app is opened and left before a fetch finishes, so
 * they should not clutter Error Logs or Sync issues.
 */
export function isTransientNetworkError(err: unknown): boolean {
  if (err == null) return false;

  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  }

  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  }

  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed") ||
    message.includes("the operation was aborted") ||
    message.includes("aborted") ||
    message.includes("aborterror") ||
    message.includes("cors request did not succeed") ||
    message.includes("fetch failed")
  );
}

/**
 * Log an error with context and store it in the database.
 * Transient network/abort errors are console-only so leaving the app mid-fetch
 * does not fill Error Logs.
 */
export function logError(context: string, err: unknown): void {
  const message = getErrorMessage(err);

  if (isTransientNetworkError(err)) {
    console.warn(`${context} (transient):`, err);
    return;
  }

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
