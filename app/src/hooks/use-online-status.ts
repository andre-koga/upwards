import { useSyncExternalStore } from "react";

function subscribeToOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

/** Current browser connectivity, kept in sync with online/offline window events. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeToOnlineStatus, () => navigator.onLine);
}
