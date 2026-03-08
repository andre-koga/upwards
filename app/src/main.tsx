import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { syncEngine } from "./lib/sync";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

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
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      syncEngine.startAutoSync(30000);
    } else if (event === "SIGNED_OUT") {
      syncEngine.stopAutoSync();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
