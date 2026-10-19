import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CloudOff } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAuth } from "@/lib/use-auth";

const emailId = "sign-in-email";
const passwordId = "sign-in-password";

/**
 * What an unauthenticated visitor sees instead of the app (product-scope.md
 * §2.6). One primary action, and making an account as a quiet second one: most
 * visits are a return, and two equal buttons ask the person to choose between
 * them every time.
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
    <AuthShell
      title={t("auth.screen.title")}
      description={t("auth.screen.subtitle")}
      footer={
        <>
          <p>
            <Link
              to="/settings/forgot-password"
              className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
            >
              {t("auth.forgotPassword")}
            </Link>
          </p>
          <p className="text-xs">{t("auth.screen.note")}</p>
        </>
      }
    >
      {!isOnline ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t("auth.screen.offline")}</span>
        </div>
      ) : null}

      <form
        onSubmit={handleSignIn}
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <Label htmlFor={emailId}>{t("auth.email")}</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 md:h-10"
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
            className="h-11 md:h-10"
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

        <Button
          type="submit"
          disabled={authLoading || !isOnline}
          className="h-11 w-full md:h-10"
        >
          {authLoading ? "…" : t("auth.signIn")}
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-muted-foreground">
          <span>{t("auth.screen.newHere")}</span>
          <Button
            type="button"
            variant="link"
            disabled={authLoading || !isOnline}
            className="h-11 px-1 md:h-10"
            onClick={() => void handleSignUp()}
          >
            {t("auth.screen.createAccount")}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
