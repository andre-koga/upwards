import { useGroupPage } from "@/hooks/use-group-page";
import ActivityFormPage from "@/components/activities/activity-form-page";

export default function NewActivityPage() {
  const { group, loading } = useGroupPage();

  if (loading)
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!group) return null;

  return <ActivityFormPage group={group} />;
}
