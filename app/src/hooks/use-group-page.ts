import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";

export function useGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<ActivityGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      navigate("/");
      return;
    }
    db.activityGroups.get(groupId).then((g) => {
      if (!g || g.deleted_at) {
        navigate("/");
        return;
      }
      setGroup(g);
      setLoading(false);
    });
  }, [groupId, navigate]);

  return { group, loading };
}
