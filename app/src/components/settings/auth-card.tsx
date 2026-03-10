import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/lib/use-auth";

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp(email, password);
      setEmail("");
      setPassword("");
    } catch {
      // authError handled by useAuth
    }
  };

  return (
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
              onClick={signOut}
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
  );
}
