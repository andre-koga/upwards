import { useState } from "react";
import { Users, UserPlus, CheckCircle2, XCircle, UserMinus, Clock } from "lucide-react";

import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFriends } from "@/lib/friends/use-friends";
import { useAuth } from "@/lib/use-auth";
import { useUserProfile } from "@/lib/use-user-profile";
import { getCachedUserId } from "@/lib/supabase";
import { Link } from "react-router-dom";

function actorLabel(
  username: string | null,
  displayName: string | null
): string {
  if (displayName && username) return `${displayName} (@${username})`;
  if (username) return `@${username}`;
  if (displayName) return displayName;
  return "Unknown user";
}

export default function FriendsPage() {
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const { username, loading: profileLoading } = useUserProfile();
  const { friends, incoming, outgoing, loading, error, sendInvite, respond, removeFriend } =
    useFriends();

  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!isSupabaseConfigured || !isAuthed) {
    return (
      <div className="space-y-3 p-4 pb-24">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6" /> Friends
          </h1>
        </header>
        <p className="text-sm text-muted-foreground">
          Sign in to add friends.
        </p>
        <FloatingBackButton to="/" title="Home" />
      </div>
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
    <div className="space-y-6 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6" /> Friends
        </h1>
        <p className="text-sm text-muted-foreground">
          Add people by exact username.
        </p>
      </header>

      {/* Require username before sending invites */}
      {!profileLoading && !username && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Set a{" "}
          <Link to="/settings" className="underline">
            username in Settings
          </Link>{" "}
          before inviting friends.
        </div>
      )}

      {/* Invite form */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add a friend
        </h2>
        <form onSubmit={(e) => void handleInvite(e)} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <Input
              className="pl-7"
              placeholder="username"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              disabled={profileLoading || !username || inviteSending}
            />
          </div>
          <Button
            type="submit"
            disabled={profileLoading || !username || inviteSending || !inviteInput.trim()}
          >
            <UserPlus className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Invite</span>
          </Button>
        </form>
        {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
      </section>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Incoming requests
          </h2>
          <ul className="space-y-2">
            {incoming.map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {actorLabel(req.profile?.username ?? null, req.profile?.displayName ?? null)}
                  </p>
                  <p className="text-xs text-muted-foreground">Wants to be friends</p>
                </div>
                <div className="ml-2 flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respondingId === req.id}
                    onClick={() => void handleRespond(req.id, true)}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="ml-1 hidden sm:inline">Accept</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={respondingId === req.id}
                    onClick={() => void handleRespond(req.id, false)}
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="ml-1 hidden sm:inline">Decline</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sent requests
          </h2>
          <ul className="space-y-2">
            {outgoing.map((req) => (
              <li
                key={req.id}
                className="flex items-center gap-2 rounded-lg border p-3"
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="flex-1 truncate text-sm">
                  {actorLabel(req.profile?.username ?? null, req.profile?.displayName ?? null)}
                </p>
                <span className="text-xs text-muted-foreground">Pending</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Friends list */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Friends
        </h2>
        {!loading && friends.length === 0 && (
          <p className="text-sm text-muted-foreground">No friends yet — invite someone!</p>
        )}
        <ul className="space-y-2">
          {friends.map((f) => {
            const otherId = f.user_a === getCachedUserId() ? f.user_b : f.user_a;
            return (
              <li
                key={`${f.user_a}-${f.user_b}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <p className="flex-1 truncate text-sm font-medium">
                  {actorLabel(f.profile?.username ?? null, f.profile?.displayName ?? null)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={removingId === otherId}
                  onClick={() => void handleRemove(otherId)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
