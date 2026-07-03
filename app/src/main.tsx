import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { syncEngine } from "./lib/sync";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { prepareSignedInSession } from "./lib/sync/auth-handoff";
import { emitGuestHandoffNeeded } from "./lib/sync/guest-handoff-emitter";
import { initializeStoredPalette } from "./lib/palette";
import "./lib/i18n";

void (async () => {
  try {
    if (!("storage" in navigator) || !("persist" in navigator.storage)) {
      return;
    }
    const alreadyPersistent = await navigator.storage.persisted();
    if (!alreadyPersistent) {
      await navigator.storage.persist();
    }
  } catch (error) {
    console.warn("Persistent storage request failed:", error);
  }
})();

// Drive auto-sync from confirmed auth state — never start before session is known
if (isSupabaseConfigured && supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      const userId = session?.user?.id;
      if (!userId) return;
      void prepareSignedInSession(userId).then((result) => {
        if (result === "ready") syncEngine.startAutoSync(60000);
        else emitGuestHandoffNeeded(userId);
      });
    } else if (event === "SIGNED_OUT") {
      syncEngine.stopAutoSync();
    }
  });
}

initializeStoredPalette();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
