import { useGroupPage } from "@/hooks/use-group-page";
import GroupActivitiesContent from "@/components/activities/group-activities-content";

export default function GroupPage() {
  const { group, loading } = useGroupPage();

  if (loading)
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!group) return null;

  return <GroupActivitiesContent group={group} />;
}
