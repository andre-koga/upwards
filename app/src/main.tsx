import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { syncEngine } from "./lib/sync";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import {
  emitAccountSwitchChoiceNeeded,
  prepareSignedInSession,
} from "./lib/sync/account-switch";
import { prepareLocalDatabase } from "./lib/db/recovery";
import { startRecoveryAutoImport } from "./lib/db/recovery-import";
import i18n from "./lib/i18n";

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

// Named palettes, the configurable day-reset hour, and the natural-ID cutover
// were removed; drop their stored flags so they can't linger.
for (const key of [
  "upwards-color-palette",
  "okhabit:day_reset_minutes",
  "okhabit_natural_identity_repaired_v1",
  "okhabit_cutover_enqueued_v1",
]) {
  localStorage.removeItem(key);
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

function startApp() {
  // Drive auto-sync from confirmed auth state — never start before session is known
  if (isSupabaseConfigured && supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        const userId = session?.user?.id;
        if (!userId) return;
        void prepareSignedInSession(userId).then((result) => {
          if (result === "ready") {
            syncEngine.startAutoSync(60000, userId);
            return;
          }
          emitAccountSwitchChoiceNeeded(userId);
        });
      } else if (event === "SIGNED_OUT") {
        syncEngine.stopAutoSync();
      }
    });
    startRecoveryAutoImport();
  }

  root.render(
    <React.StrictMode>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}

// Must finish before anything opens Dexie: a database older than the baseline
// is moved into a recovery bundle and deleted first. If the bundle cannot be
// saved, the old database is left untouched and the app does not open it.
prepareLocalDatabase().then(startApp, (error: unknown) => {
  // Not logError: it writes to Dexie, which must stay closed here.
  console.error("Local database recovery failed", error);
  root.render(
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="max-w-sm text-pretty text-sm">
        {i18n.t("sync.recovery.bootFailed", { ns: "settings" })}
      </p>
      <button
        type="button"
        className="rounded-md border px-4 py-2 text-sm"
        onClick={() => window.location.reload()}
      >
        {i18n.t("sync.recovery.retry", { ns: "settings" })}
      </button>
    </main>
  );
});
