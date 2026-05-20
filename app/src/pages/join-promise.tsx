import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { HandshakeIcon } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { usePromises } from "@/lib/promises/use-promises";
import { lookupPromiseForInvite } from "@/lib/promises/use-promises";
import { cn } from "@/lib/utils";
import { getActivityDisplayName } from "@/lib/activity";
import { db } from "@/lib/db";

export default function JoinPromisePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const { acceptInvite, eligibleActivities } = usePromises();

  const [info, setInfo] = useState<Awaited<
    ReturnType<typeof lookupPromiseForInvite>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityId, setActivityId] = useState("");
  const [joining, setJoining] = useState(false);
  const [groups, setGroups] = useState<Record<string, string>>({});

  useEffect(() => {
     
    db.activityGroups
      .filter((g) => !g.deleted_at)
      .toArray()
      .then((gs) => {
        const map: Record<string, string> = {};
        for (const g of gs) map[g.id] = g.name;
        setGroups(map);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!token) return;
     
    lookupPromiseForInvite(token)
      .then((result) => {
        setInfo(result);
        setActivityId(eligibleActivities[0]?.id ?? "");
      })
      .catch(() => setError("Failed to load invite."))
      .finally(() => setLoading(false));
  }, [token, eligibleActivities]);

  const isMutual = info?.invite.mode === "mutual";

  const handleJoin = async () => {
    if (!token) return;
    setJoining(true);
    setError(null);
    try {
      const promiseId = await acceptInvite({
        token,
        activityId: isMutual ? activityId : undefined,
      });
      navigate(`/promises/${promiseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join.");
      setJoining(false);
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HandshakeIcon className="h-6 w-6 shrink-0 text-primary" />
          Join a promise
        </h1>
      </header>

      {!isAuthed ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm">
            You need to sign in to accept a promise invite.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/settings")}
          >
            Sign in from Settings
          </Button>
        </div>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading invite…
        </p>
      ) : !info ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {error ?? "Invite not found or already used."}
          </p>
          <Button variant="outline" onClick={() => navigate("/promises")}>
            Go to Promises
          </Button>
        </div>
      ) : info.invite.accepted_at ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">
            This invite has already been accepted.
          </p>
          <Button variant="outline" onClick={() => navigate("/promises")}>
            Go to Promises
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="font-semibold">{info.promise.title}</p>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              {isMutual
                ? "Mutual commitment — you'll both track this habit"
                : "Witness — you'll track their progress"}
            </p>
          </div>

          {isMutual && eligibleActivities.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Your habit for this promise</p>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {eligibleActivities.map((a) => {
                  const name = getActivityDisplayName(a, {
                    id: a.group_id,
                    name: groups[a.group_id] ?? "",
                    emoji: null,
                    color: null,
                    order_index: null,
                    is_archived: false,
                    created_at: "",
                    updated_at: "",
                    synced_at: null,
                    deleted_at: null,
                  });
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        activityId === a.id
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border hover:bg-muted/60"
                      )}
                      onClick={() => setActivityId(a.id)}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            disabled={joining || (isMutual && !activityId)}
            onClick={handleJoin}
          >
            {joining ? "Joining…" : "Accept promise"}
          </Button>
        </div>
      )}

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
