import { useState } from "react";
import { Link } from "react-router-dom";

import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/use-auth";

const emailId = "forgot-password-email";

export default function ForgotPasswordPage() {
  const { isSupabaseConfigured, authLoading, authError, setAuthError, resetPassword } =
    useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSent(false);
    try {
      await resetPassword(email);
      setSent(true);
      setAuthError(null);
    } catch {
      // authError set in useAuth
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">
            Sync is not configured for this build.
          </p>
        </header>
        <FloatingBackButton to="/settings" title="Settings" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email for your sync account. We will send a link to choose a
          new password.
        </p>
      </header>

      {sent ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm text-green-600 dark:text-green-500">
            If an account exists for {email.trim()}, you will receive a reset link
            shortly. Check your inbox and spam folder.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/settings">Back to Settings</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
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

          {authError && (
            <p className="text-xs text-destructive">{authError}</p>
          )}

          <Button type="submit" className="w-full" disabled={authLoading}>
            {authLoading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/settings" className="underline underline-offset-2">
          Back to Settings
        </Link>
      </p>

      <FloatingBackButton to="/settings" title="Settings" />
    </div>
  );
}
