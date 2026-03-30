import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/ui/settings-section";
import { useAuth } from "@/lib/use-auth";

const emailId = "settings-sync-email";
const passwordId = "settings-sync-password";

export function AuthCard() {
  const {
    isAuthed,
    currentUserEmail,
    authLoading,
    authError,
    setAuthError,
    signIn,
    signUp,
    signOut,
  } = useAuth();
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthed) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with auth state */
      setShowAuthForm(false);
      setEmail("");
      setPassword("");
    }
  }, [isAuthed]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch {
      // authError handled by useAuth
    }
  };

  const handleSignUp = async () => {
    try {
      await signUp(email, password);
      setEmail("");
      setPassword("");
    } catch {
      // authError handled by useAuth
    }
  };

  return (
    <SettingsSection title="Sync account">
      {isAuthed ? (
        <>
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {currentUserEmail ?? "Unknown email"}
            </span>
          </p>
          <Button
            variant="outline"
            className="flex w-full items-center gap-2"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            className="flex w-full items-center gap-2"
            onClick={() => {
              setShowAuthForm((prev) => !prev);
              setAuthError(null);
            }}
          >
            <LogIn className="h-4 w-4" />
            {showAuthForm ? "Hide login" : "Sign in / Sign up"}
          </Button>

          {showAuthForm && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={emailId}>Email</Label>
                <Input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={passwordId}>Password</Label>
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

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
                  {authLoading ? "…" : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={authLoading}
                  className="flex-1"
                  onClick={() => void handleSignUp()}
                >
                  {authLoading ? "…" : "Sign up"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </SettingsSection>
  );
}
