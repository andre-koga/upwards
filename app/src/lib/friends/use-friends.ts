import { useCallback, useEffect, useState } from "react";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { lookupUserByUsername } from "@/lib/use-user-profile";
import type { FriendRequest, Friendship } from "@/lib/db/types";

export interface FriendProfile {
  userId: string;
  username: string | null;
  displayName: string | null;
}

export interface FriendRequestWithProfile extends FriendRequest {
  profile: FriendProfile | null;
}

export interface FriendWithProfile extends Friendship {
  profile: FriendProfile | null;
}

export function useFriends() {
  const userId = getCachedUserId();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestWithProfile[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const [
        { data: friendships, error: fErr },
        { data: incomingReqs, error: iErr },
        { data: outgoingReqs, error: oErr },
      ] = await Promise.all([
        supabase
          .from("friendships")
          .select("user_a, user_b, created_at")
          .or(`user_a.eq.${userId},user_b.eq.${userId}`),
        supabase
          .from("friend_requests")
          .select("id, from_user_id, to_user_id, status, created_at, responded_at")
          .eq("to_user_id", userId)
          .eq("status", "pending"),
        supabase
          .from("friend_requests")
          .select("id, from_user_id, to_user_id, status, created_at, responded_at")
          .eq("from_user_id", userId)
          .eq("status", "pending"),
      ]);

      if (fErr) throw fErr;
      if (iErr) throw iErr;
      if (oErr) throw oErr;

      // Collect unique other-user ids for profile lookup
      const otherIds = new Set<string>();
      for (const f of friendships ?? []) {
        otherIds.add(f.user_a === userId ? f.user_b : f.user_a);
      }
      for (const r of [...(incomingReqs ?? []), ...(outgoingReqs ?? [])]) {
        otherIds.add(r.from_user_id === userId ? r.to_user_id : r.from_user_id);
      }

      const profileMap = await fetchUserProfiles([...otherIds]);

      setFriends(
        (friendships ?? []).map((f: Friendship) => {
          const otherId = f.user_a === userId ? f.user_b : f.user_a;
          return { ...f, profile: profileMap.get(otherId) ?? null };
        })
      );
      setIncoming(
        (incomingReqs ?? []).map((r: FriendRequest) => ({
          ...r,
          profile: profileMap.get(r.from_user_id) ?? null,
        }))
      );
      setOutgoing(
        (outgoingReqs ?? []).map((r: FriendRequest) => ({
          ...r,
          profile: profileMap.get(r.to_user_id) ?? null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load();
  }, [load]);

  /** Send a friend invite by exact username. */
  const sendInvite = useCallback(
    async (username: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: "Sign in to add friends" };

      const found = await lookupUserByUsername(username);
      if (!found) return { error: `No user found with username @${username}` };
      if (found.user_id === userId) return { error: "You can't add yourself" };

      const { error } = await supabase.from("friend_requests").insert({
        from_user_id: userId,
        to_user_id: found.user_id,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") {
          return { error: "You already sent an invite to this person." };
        }
        return { error: error.message };
      }
      await load();
      return { error: null };
    },
    [userId, load]
  );

  /** Accept or decline an incoming friend request. */
  const respond = useCallback(
    async (requestId: string, accept: boolean): Promise<{ error: string | null }> => {
      if (!supabase) return { error: "Not connected" };
      if (accept) {
        const { error } = await supabase.rpc("accept_friend_request", {
          request_id: requestId,
        });
        if (error) return { error: error.message };
      } else {
        const { error } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", requestId);
        if (error) return { error: error.message };
      }
      await load();
      return { error: null };
    },
    [load]
  );

  /** Remove a friendship (both directions). */
  const removeFriend = useCallback(
    async (otherUserId: string): Promise<{ error: string | null }> => {
      if (!supabase || !userId) return { error: "Not connected" };
      const a = userId < otherUserId ? userId : otherUserId;
      const b = userId < otherUserId ? otherUserId : userId;
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_a", a)
        .eq("user_b", b);
      if (error) return { error: error.message };
      await load();
      return { error: null };
    },
    [userId, load]
  );

  return { friends, incoming, outgoing, loading, error, reload: load, sendInvite, respond, removeFriend };
}

export async function fetchUserProfiles(
  userIds: string[]
): Promise<Map<string, FriendProfile>> {
  const map = new Map<string, FriendProfile>();
  if (!supabase || userIds.length === 0) return map;
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, username, display_name")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    map.set(row.user_id as string, {
      userId: row.user_id as string,
      username: (row.username as string | null) ?? null,
      displayName: (row.display_name as string | null) ?? null,
    });
  }
  return map;
}
