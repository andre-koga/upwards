import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { syncEngine } from "@/lib/sync";
import {
  supabase,
  isAuthenticated,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  Sun,
  Archive,
  ArrowUpDown,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  LogIn,
  LogOut,
} from "lucide-react";
import { useDataBackup } from "@/components/settings/use-data-backup";

export default function SettingsPageContent() {
  const [isAuthed, setIsAuthed] = useState(isAuthenticated());
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    fileInputRef,
    exportStatus,
    importStatus,
    importMessage,
    handleExport,
    handleImport,
  } = useDataBackup();

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      setCurrentUserEmail(data.session?.user?.email ?? null);
    })();

    const subscription = supabase
      ? supabase.auth.onAuthStateChange((event, session) => {
          setIsAuthed(Boolean(session));
          setCurrentUserEmail(session?.user?.email ?? null);
          if (event === "SIGNED_IN") {
            setShowAuthForm(false);
            setEmail("");
            setPassword("");
          }
        }).data.subscription
      : null;

    return () => subscription?.unsubscribe();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      setAuthError("Check your email to confirm your account!");
      setEmail("");
      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign up failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await syncEngine.pushBeforeSignOut();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign out failed");
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <ThemeSwitcher />
          </div>
        </CardContent>
      </Card>

      {isSupabaseConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sync Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAuthed ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Signed in as{" "}
                  <span className="text-foreground font-medium">
                    {currentUserEmail ?? "Unknown email"}
                  </span>
                </p>
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2"
                  onClick={() => {
                    setShowAuthForm((prev) => !prev);
                    setAuthError(null);
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  {showAuthForm ? "Hide Login" : "Sign In / Sign Up"}
                </Button>

                {showAuthForm && (
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />

                    {authError && (
                      <p
                        className={`text-xs ${authError.includes("Check your email") ? "text-green-500" : "text-destructive"}`}
                      >
                        {authError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={authLoading}
                        className="flex-1"
                      >
                        {authLoading ? "..." : "Sign In"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={authLoading}
                        className="flex-1"
                        onClick={handleSignUp}
                      >
                        {authLoading ? "..." : "Sign Up"}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            View and manage your archived activity groups and activities.
          </p>
          <Link to="/settings/archived">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              View Archived Items
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Task Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Choose the display order for scheduled tasks shown on the home page.
          </p>
          <Link to="/settings/task-order">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />
              Reorder Daily Tasks
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Download className="h-4 w-4" />
            Data Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export all your data as a JSON file or restore from a previous
            backup.
          </p>

          <Button
            variant="outline"
            className="w-full flex items-center gap-2"
            onClick={handleExport}
          >
            {exportStatus === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : exportStatus === "error" ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportStatus === "success"
              ? "Downloaded!"
              : exportStatus === "error"
                ? "Export failed"
                : "Export Backup"}
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              {importStatus === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : importStatus === "error" ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {importStatus === "success"
                ? "Imported!"
                : importStatus === "error"
                  ? "Import failed"
                  : "Import Backup"}
            </Button>
            {importMessage && (
              <p
                className={`text-xs mt-1 text-center ${
                  importStatus === "error"
                    ? "text-destructive"
                    : "text-green-600"
                }`}
              >
                {importMessage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>Upwards — local-first habit tracker</p>
      </div>

      {/* Fixed bottom-left home button */}
      <Link
        to="/"
        className="fixed bottom-6 left-6 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-background border border-border shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Home"
      >
        <X className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
