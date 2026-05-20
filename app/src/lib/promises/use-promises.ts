import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCachedUserId } from "@/lib/supabase";
import type {
  Promise as PromiseRecord,
  PromiseMember,
  PromiseInvite,
  Activity,
} from "@/lib/db/types";
import { db, newId, now } from "@/lib/db";
import { isActiveActivity } from "@/lib/activity";

export interface PromiseWithMembers extends PromiseRecord {
  members: PromiseMember[];
}

export function usePromises() {
  const [promises, setPromises] = useState<PromiseWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = getCachedUserId();

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data: memberRows, error: memberError } = await supabase
        .from("promise_members")
        .select("promise_id")
        .eq("user_id", userId)
        .neq("invite_status", "declined");

      if (memberError) throw memberError;

      const promiseIds = [
        ...new Set((memberRows ?? []).map((r) => r.promise_id as string)),
      ];

      if (promiseIds.length === 0) {
        setPromises([]);
        setLoading(false);
        return;
      }

      const { data: promiseRows, error: promiseError } = await supabase
        .from("promises")
        .select("*")
        .in("id", promiseIds)
        .order("created_at", { ascending: false });

      if (promiseError) throw promiseError;

      const { data: allMembers, error: allMembersError } = await supabase
        .from("promise_members")
        .select("*")
        .in("promise_id", promiseIds);

      if (allMembersError) throw allMembersError;

      const membersByPromise = new Map<string, PromiseMember[]>();
      for (const m of allMembers ?? []) {
        const list = membersByPromise.get(m.promise_id) ?? [];
        list.push(m as PromiseMember);
        membersByPromise.set(m.promise_id, list);
      }

      setPromises(
        (promiseRows ?? []).map((p) => ({
          ...(p as PromiseRecord),
          members: membersByPromise.get(p.id) ?? [],
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promises");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- loading remote promises into local state on mount/auth change */
    void load();
  }, [load]);

  const createPromise = useCallback(
    async (params: {
      title: string;
      mode: "mutual" | "witness";
      activityId: string;
      inviteEmail?: string;
    }) => {
      if (!supabase || !userId) throw new Error("Sign in to create promises");

      const promiseId = newId();
      const ts = now();

      const { error: pErr } = await supabase.from("promises").insert({
        id: promiseId,
        creator_id: userId,
        title: params.title,
        mode: params.mode,
        status: "active",
        creator_activity_id: params.activityId,
        created_at: ts,
        completed_at: null,
      });
      if (pErr) throw pErr;

      // Creator is always "owner" + accepted
      const { error: mErr } = await supabase.from("promise_members").insert({
        id: newId(),
        promise_id: promiseId,
        user_id: userId,
        role: "owner",
        member_activity_id: params.activityId,
        invite_status: "accepted",
        display_name: null,
        joined_at: ts,
        created_at: ts,
        updated_at: ts,
      });
      if (mErr) throw mErr;

      // Generate invite token
      const token = generateToken();
      const { error: iErr } = await supabase.from("promise_invites").insert({
        id: newId(),
        promise_id: promiseId,
        token,
        email: params.inviteEmail ?? null,
        mode: params.mode,
        created_at: ts,
        expires_at: null,
        accepted_at: null,
      });
      if (iErr) throw iErr;

      await load();
      return { promiseId, token };
    },
    [userId, load]
  );

  const acceptInvite = useCallback(
    async (params: { token: string; activityId?: string }) => {
      if (!supabase || !userId) throw new Error("Sign in to accept invites");

      const { data: invite, error: inviteErr } = await supabase
        .from("promise_invites")
        .select("*")
        .eq("token", params.token)
        .maybeSingle();

      if (inviteErr) throw inviteErr;
      if (!invite) throw new Error("Invite not found or expired");
      if (invite.accepted_at) throw new Error("Invite already accepted");

      const { data: promise, error: promiseErr } = await supabase
        .from("promises")
        .select("*")
        .eq("id", invite.promise_id)
        .maybeSingle();

      if (promiseErr) throw promiseErr;
      if (!promise) throw new Error("Promise not found");

      const ts = now();
      const role =
        invite.mode === "witness"
          ? "witness"
          : promise.creator_id === userId
            ? "owner"
            : "member";

      const { error: mErr } = await supabase.from("promise_members").upsert(
        {
          id: newId(),
          promise_id: invite.promise_id,
          user_id: userId,
          role,
          member_activity_id:
            invite.mode === "mutual" ? (params.activityId ?? null) : null,
          invite_status: "accepted",
          display_name: null,
          joined_at: ts,
          created_at: ts,
          updated_at: ts,
        },
        { onConflict: "promise_id,user_id" }
      );
      if (mErr) throw mErr;

      await supabase
        .from("promise_invites")
        .update({ accepted_at: ts })
        .eq("id", invite.id);

      await load();
      return invite.promise_id as string;
    },
    [userId, load]
  );

  const endPromise = useCallback(
    async (promiseId: string, status: "completed" | "cancelled") => {
      if (!supabase) return;
      const ts = now();
      await supabase
        .from("promises")
        .update({
          status,
          completed_at: status === "completed" ? ts : null,
        })
        .eq("id", promiseId);
      await load();
    },
    [load]
  );

  // Activities eligible to anchor a new promise (active, non-completed)
  const [eligibleActivities, setEligibleActivities] = useState<Activity[]>([]);
  useEffect(() => {
     
    db.activities
      .filter((a) => isActiveActivity(a))
      .toArray()
      .then((acts) => setEligibleActivities(acts))
      .catch(console.error);
  }, []);

  return {
    promises,
    loading,
    error,
    reload: load,
    createPromise,
    acceptInvite,
    endPromise,
    eligibleActivities,
    isSignedIn: Boolean(userId && supabase),
  };
}

// ─── Invite link helpers ──────────────────────────────────────────────────────

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/promises/join/${token}`;
}

export async function lookupInvite(
  token: string
): Promise<PromiseInvite | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("promise_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as PromiseInvite | null) ?? null;
}

export async function lookupPromiseForInvite(
  token: string
): Promise<{ invite: PromiseInvite; promise: PromiseRecord } | null> {
  if (!supabase) return null;
  const invite = await lookupInvite(token);
  if (!invite) return null;

  const { data } = await supabase
    .from("promises")
    .select("*")
    .eq("id", invite.promise_id)
    .maybeSingle();

  if (!data) return null;
  return { invite, promise: data as PromiseRecord };
}
