import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CloudOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAuth } from "@/lib/use-auth";

const emailId = "sign-in-email";
const passwordId = "sign-in-password";

/**
 * What an unauthenticated visitor sees instead of the app (product-scope.md
 * §2.6). A minimal full-screen version of the old settings auth card until the
 * redesign's onboarding replaces it.
 */
export function SignInScreen() {
  const { t } = useTranslation("settings");
  const isOnline = useOnlineStatus();
  const { authLoading, authError, setAuthError, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch {
      // authError is set by useAuth.
    }
  };

  const handleSignUp = async () => {
    setAuthError(null);
    try {
      await signUp(email, password);
      setPassword("");
    } catch {
      // authError is set by useAuth.
    }
  };

  const confirmationSent = authError === t("auth.checkEmail");

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <header className="mb-8 space-y-2">
        <h1 className="font-display text-4xl tracking-tight">
          {t("auth.screen.title")}
        </h1>
        <p className="text-pretty text-muted-foreground">
          {t("auth.screen.subtitle")}
        </p>
      </header>

      {!isOnline ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t("auth.screen.offline")}</span>
        </div>
      ) : null}

      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={emailId}>{t("auth.email")}</Label>
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
          <Label htmlFor={passwordId}>{t("auth.password")}</Label>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {authError ? (
          <p
            role={confirmationSent ? "status" : "alert"}
            className={`text-sm ${confirmationSent ? "text-green" : "text-destructive"}`}
          >
            {authError}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={authLoading || !isOnline}
            className="flex-1"
          >
            {authLoading ? "…" : t("auth.signIn")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={authLoading || !isOnline}
            className="flex-1"
            onClick={() => void handleSignUp()}
          >
            {authLoading ? "…" : t("auth.signUp")}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-center">
        <Link
          to="/settings/forgot-password"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("auth.forgotPassword")}
        </Link>
      </p>
    </div>
  );
}
