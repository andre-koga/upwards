import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
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
        console.warn("[auth] setSession from recovery hash failed:", error.message);
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
  const { isSupabaseConfigured, authLoading, authError, updatePassword } = useAuth();
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setCheckingLink(false);
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

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("auth.resetPasswordPage.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.syncNotConfigured")}
          </p>
        </header>
        <FloatingBackButton to="/settings" title={tNav("settings")} />
      </div>
    );
  }

  if (checkingLink) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("auth.resetPasswordPage.title")}
          </h1>
        </header>
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("auth.resetPasswordPage.verifying")}
        </p>
        <FloatingBackButton to="/settings" title={tNav("settings")} />
      </div>
    );
  }

  if (!linkValid && !done) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("auth.resetPasswordPage.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.resetPasswordPage.invalidLink")}
          </p>
        </header>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/settings/forgot-password">
            {t("auth.resetPasswordPage.requestNewLink")}
          </Link>
        </Button>
        <FloatingBackButton to="/settings" title={tNav("settings")} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("auth.resetPasswordPage.updatedTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.resetPasswordPage.updatedDescription")}
          </p>
        </header>
        <Button
          className="w-full"
          onClick={() => navigate("/settings", { replace: true })}
        >
          {t("auth.resetPasswordPage.goToSettings")}
        </Button>
        <FloatingBackButton to="/settings" title={tNav("settings")} />
      </div>
    );
  }

  const errorMessage = localError ?? authError;

  return (
    <div className="space-y-3 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("auth.resetPasswordPage.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.resetPasswordPage.chooseDescription")}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
        <div className="space-y-2">
          <Label htmlFor={passwordId}>
            {t("auth.resetPasswordPage.newPassword")}
          </Label>
          <Input
            id={passwordId}
            type="password"
            autoComplete="new-password"
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
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {errorMessage && (
          <p className="text-xs text-destructive">{errorMessage}</p>
        )}

        <Button type="submit" className="w-full" disabled={authLoading}>
          {authLoading
            ? tCommon("saving")
            : t("auth.resetPasswordPage.saveNewPassword")}
        </Button>
      </form>

      <FloatingBackButton to="/settings" title={tNav("settings")} />
    </div>
  );
}
