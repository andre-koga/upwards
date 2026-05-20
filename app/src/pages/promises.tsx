import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { HandshakeIcon, Plus, Users } from "lucide-react";
import { usePromises } from "@/lib/promises/use-promises";
import { useAuth } from "@/lib/use-auth";
import { CreatePromiseDialog } from "@/components/promises/create-promise-dialog";
import { PromiseCard } from "@/components/promises/promise-card";
import { AcceptInviteDialog } from "@/components/promises/accept-invite-dialog";

export default function PromisesPage() {
  const navigate = useNavigate();
  const { isAuthed, isSupabaseConfigured } = useAuth();
  const { promises, loading, createPromise, acceptInvite, eligibleActivities } =
    usePromises();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinToken, setJoinToken] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);

  const active = promises.filter((p) => p.status === "active");
  const past = promises.filter((p) => p.status !== "active");

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HandshakeIcon className="h-6 w-6 shrink-0 text-primary" />
          Promises
        </h1>
        <p className="text-sm text-muted-foreground">
          Habit commitments shared with specific people — no feed, no likes.
        </p>
      </header>

      {!isSupabaseConfigured || !isAuthed ? (
        <SettingsSection title="Sign in required">
          <p className="text-sm text-muted-foreground">
            Promises are a cloud feature. Sign in from Settings → Sync account
            to create and join promises with others.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/settings")}
          >
            Go to Settings
          </Button>
        </SettingsSection>
      ) : (
        <>
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New promise
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => setJoinOpen(true)}
            >
              <Users className="h-4 w-4" />
              Join with code
            </Button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : active.length === 0 && past.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <HandshakeIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No promises yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first promise to keep a habit with someone you trust.
              </p>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div className="space-y-2">
                  {active.map((p) => (
                    <PromiseCard
                      key={p.id}
                      promise={p}
                      onClick={() => navigate(`/promises/${p.id}`)}
                    />
                  ))}
                </div>
              )}

              {past.length > 0 && (
                <SettingsSection title="Completed & cancelled">
                  <div className="space-y-2">
                    {past.map((p) => (
                      <PromiseCard
                        key={p.id}
                        promise={p}
                        onClick={() => navigate(`/promises/${p.id}`)}
                        muted
                      />
                    ))}
                  </div>
                </SettingsSection>
              )}
            </>
          )}
        </>
      )}

      <CreatePromiseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        activities={eligibleActivities}
        onCreated={async (params) => {
          const result = await createPromise(params);
          setCreateOpen(false);
          return result;
        }}
      />

      <AcceptInviteDialog
        open={joinOpen}
        token={joinToken}
        onTokenChange={setJoinToken}
        onOpenChange={(v) => {
          setJoinOpen(v);
          if (!v) setJoinToken("");
        }}
        activities={eligibleActivities}
        onAccepted={async (token, activityId) => {
          const promiseId = await acceptInvite({ token, activityId });
          setJoinOpen(false);
          setJoinToken("");
          navigate(`/promises/${promiseId}`);
        }}
      />

      <FloatingBackButton to="/" title="Home" />
    </div>
  );
}
