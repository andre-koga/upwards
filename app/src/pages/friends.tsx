import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  UserMinus,
  Clock,
} from "lucide-react";

import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import { useUserProfile } from "@/lib/use-user-profile";
import { getCachedUserId } from "@/lib/supabase";
import { Link } from "react-router-dom";

function actorLabel(
  username: string | null,
  displayName: string | null,
  t: (key: string, opts?: Record<string, string>) => string
): string {
  if (displayName && username)
    return t("actorWithUsername", { displayName, username });
  if (username) return t("actorUsernameOnly", { username });
  if (displayName) return displayName;
  return t("unknownUser");
}

export default function FriendsPage() {
  const { t } = useTranslation("friends");
  const { t: tCommon } = useTranslation("common");
  const { t: tNav } = useTranslation("nav");
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const { username, loading: profileLoading } = useUserProfile();
  const {
    friends,
    incoming,
    outgoing,
    loading,
    error,
    sendInvite,
    respond,
    removeFriend,
  } = useFriends();

  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!isSupabaseConfigured || !isAuthed) {
    return (
      <AppPageShell
        title={t("title")}
        titleIcon={<Users className="h-6 w-6" />}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">{t("signInRequired")}</p>
        <FloatingBackButton to="/" title={tNav("home")} />
      </AppPageShell>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const trimmed = inviteInput.trim().replace(/^@/, "");
    if (!trimmed) return;
    setInviteSending(true);
    const { error: err } = await sendInvite(trimmed);
    setInviteSending(false);
    if (err) {
      setInviteError(err);
    } else {
      setInviteInput("");
    }
  };

  const handleRespond = async (id: string, accept: boolean) => {
    setRespondingId(id);
    await respond(id, accept);
    setRespondingId(null);
  };

  const handleRemove = async (otherUserId: string) => {
    setRemovingId(otherUserId);
    await removeFriend(otherUserId);
    setRemovingId(null);
  };

  return (
    <AppPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      titleIcon={<Users className="h-6 w-6" />}
    >
      {!profileLoading && !username && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("setUsername")}{" "}
          <Link to="/settings" className="underline">
            {t("usernameInSettings")}
          </Link>{" "}
          {t("beforeInviting")}
        </div>
      )}

      <section className="space-y-3">
        <SectionLabel asChild className="text-sm">
          <h2>{t("addFriend")}</h2>
        </SectionLabel>
        <form onSubmit={(e) => void handleInvite(e)} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <Input
              className="pl-7"
              placeholder={t("usernamePlaceholder")}
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              disabled={profileLoading || !username || inviteSending}
            />
          </div>
          <Button
            type="submit"
            disabled={
              profileLoading ||
              !username ||
              inviteSending ||
              !inviteInput.trim()
            }
            aria-label={t("invite")}
          >
            <UserPlus className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">{t("invite")}</span>
          </Button>
        </form>
        {inviteError && (
          <p className="text-xs text-destructive">{inviteError}</p>
        )}
      </section>

      {loading && (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {incoming.length > 0 && (
        <section className="space-y-2">
          <SectionLabel asChild className="text-sm">
            <h2>{t("incomingRequests")}</h2>
          </SectionLabel>
          <ul className="space-y-2">
            {incoming.map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {actorLabel(
                      req.profile?.username ?? null,
                      req.profile?.displayName ?? null,
                      t
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("wantsToBeFriends")}
                  </p>
                </div>
                <div className="ml-2 flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respondingId === req.id}
                    onClick={() => void handleRespond(req.id, true)}
                    aria-label={t("accept")}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="ml-1 hidden sm:inline">{t("accept")}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={respondingId === req.id}
                    onClick={() => void handleRespond(req.id, false)}
                    aria-label={t("decline")}
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="ml-1 hidden sm:inline">
                      {t("decline")}
                    </span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="space-y-2">
          <SectionLabel asChild className="text-sm">
            <h2>{t("sentRequests")}</h2>
          </SectionLabel>
          <ul className="space-y-2">
            {outgoing.map((req) => (
              <li
                key={req.id}
                className="flex items-center gap-2 rounded-lg border p-3"
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="flex-1 truncate text-sm">
                  {actorLabel(
                    req.profile?.username ?? null,
                    req.profile?.displayName ?? null,
                    t
                  )}
                </p>
                <span className="text-xs text-muted-foreground">
                  {t("pending")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <SectionLabel asChild className="text-sm">
          <h2>{t("friendsList")}</h2>
        </SectionLabel>
        {!loading && friends.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noFriendsYet")}</p>
        )}
        <ul className="space-y-2">
          {friends.map((f) => {
            const otherId =
              f.user_a === getCachedUserId() ? f.user_b : f.user_a;
            return (
              <li
                key={`${f.user_a}-${f.user_b}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <p className="flex-1 truncate text-sm font-medium">
                  {actorLabel(
                    f.profile?.username ?? null,
                    f.profile?.displayName ?? null,
                    t
                  )}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={removingId === otherId}
                  onClick={() => void handleRemove(otherId)}
                  aria-label={t("removeFriend")}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
