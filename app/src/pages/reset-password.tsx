import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { settingsPanelPath } from "@/lib/settings/panels";
import { useAuth } from "@/lib/use-auth";

const passwordId = "reset-password-new";
const confirmId = "reset-password-confirm";

async function establishRecoverySession(): Promise<boolean> {
  if (!supabase) return false;

  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn("[auth] exchangeCodeForSession failed:", error.message);
      return false;
    }
    window.history.replaceState({}, "", window.location.pathname);
    return true;
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.warn(
          "[auth] setSession from recovery hash failed:",
          error.message
        );
        return false;
      }
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    }
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export default function ResetPasswordPage() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { t: tNav } = useTranslation("nav");
  const navigate = useNavigate();
  const {
    isSupabaseConfigured,
    isAuthed,
    authLoading,
    authError,
    updatePassword,
  } = useAuth();
  const [checkingLink, setCheckingLink] = useState(() =>
    Boolean(supabase && isSupabaseConfigured)
  );
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      return;
    }

    let cancelled = false;

    const verify = async () => {
      const ok = await establishRecoverySession();
      if (!cancelled) {
        setLinkValid(ok);
        setCheckingLink(false);
      }
    };

    void verify();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setLinkValid(true);
        setCheckingLink(false);
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [isSupabaseConfigured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 6) {
      setLocalError(t("auth.resetPasswordPage.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setLocalError(t("auth.resetPasswordPage.passwordMismatch"));
      return;
    }

    try {
      await updatePassword(password);
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch {
      // authError from useAuth
    }
  };

  const linkClass =
    "inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground";
  // Signed out, the way back is sign-in at the root. Signed in, it is Settings.
  const back = isAuthed ? (
    <Link to={settingsPanelPath("account")} className={linkClass}>
      {tNav("backToSettings")}
    </Link>
  ) : (
    <Link to="/" className={linkClass}>
      {t("auth.backToSignIn")}
    </Link>
  );

  if (!isSupabaseConfigured) {
    return (
      <AuthShell
        title={t("auth.resetPasswordPage.title")}
        description={t("auth.syncNotConfigured")}
        footer={back}
      >
        {null}
      </AuthShell>
    );
  }

  if (checkingLink) {
    return (
      <AuthShell
        title={t("auth.resetPasswordPage.title")}
        description={t("auth.resetPasswordPage.verifying")}
      >
        {null}
      </AuthShell>
    );
  }

  if (!linkValid && !done) {
    return (
      <AuthShell
        title={t("auth.resetPasswordPage.title")}
        description={t("auth.resetPasswordPage.invalidLink")}
        footer={back}
      >
        <Button asChild className="h-11 w-full md:h-10">
          <Link to="/settings/forgot-password">
            {t("auth.resetPasswordPage.requestNewLink")}
          </Link>
        </Button>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title={t("auth.resetPasswordPage.updatedTitle")}
        description={t("auth.resetPasswordPage.updatedDescription")}
      >
        <Button
          className="h-11 w-full md:h-10"
          onClick={() =>
            navigate(isAuthed ? settingsPanelPath("account") : "/", {
              replace: true,
            })
          }
        >
          {isAuthed
            ? t("auth.resetPasswordPage.goToSettings")
            : t("auth.resetPasswordPage.continue")}
        </Button>
      </AuthShell>
    );
  }

  const errorMessage = localError ?? authError;

  return (
    <AuthShell
      title={t("auth.resetPasswordPage.title")}
      description={t("auth.resetPasswordPage.chooseDescription")}
      footer={back}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <Label htmlFor={passwordId}>
            {t("auth.resetPasswordPage.newPassword")}
          </Label>
          <Input
            id={passwordId}
            type="password"
            autoComplete="new-password"
            className="h-11 md:h-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={confirmId}>
            {t("auth.resetPasswordPage.confirmPassword")}
          </Label>
          <Input
            id={confirmId}
            type="password"
            autoComplete="new-password"
            className="h-11 md:h-10"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          className="h-11 w-full md:h-10"
          disabled={authLoading}
        >
          {authLoading
            ? tCommon("saving")
            : t("auth.resetPasswordPage.saveNewPassword")}
        </Button>
      </form>
    </AuthShell>
  );
}
