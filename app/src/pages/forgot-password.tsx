import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/use-auth";

const emailId = "forgot-password-email";

export default function ForgotPasswordPage() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { t: tNav } = useTranslation("nav");
  const {
    isSupabaseConfigured,
    isAuthed,
    authLoading,
    authError,
    setAuthError,
    resetPassword,
  } = useAuth();
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

  // Signed out, the way back is the sign-in screen at the root. Signed in
  // (a link opened from inside the app), it is Settings.
  const back = isAuthed ? (
    <Link
      to={"/settings"}
      className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
    >
      {tNav("backToSettings")}
    </Link>
  ) : (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
    >
      {t("auth.backToSignIn")}
    </Link>
  );

  if (!isSupabaseConfigured) {
    return (
      <AuthShell
        title={t("auth.forgotPasswordPage.title")}
        description={t("auth.syncNotConfigured")}
        footer={back}
      >
        {null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("auth.forgotPasswordPage.title")}
      description={t("auth.forgotPasswordPage.description")}
      footer={back}
    >
      {sent ? (
        <div
          role="status"
          className="rounded-2xl bg-muted/45 px-5 py-4 text-center"
        >
          <p className="text-sm text-green">
            {t("auth.forgotPasswordPage.sent", { email: email.trim() })}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label
              className="px-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
              htmlFor={emailId}
            >
              {tCommon("email")}
            </Label>
            <Input
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder={tCommon("emailPlaceholder")}
              className="h-12 rounded-xl px-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {authError && (
            <p role="alert" className="text-sm text-destructive">
              {authError}
            </p>
          )}

          <Button
            type="submit"
            className="h-12 w-full rounded-full text-[0.9375rem]"
            disabled={authLoading}
          >
            {authLoading
              ? t("auth.forgotPasswordPage.sending")
              : t("auth.forgotPasswordPage.sendLink")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
