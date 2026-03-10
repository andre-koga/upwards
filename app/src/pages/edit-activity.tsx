import { useGroupActivityPage } from "@/components/activities/hooks/use-group-activity-page";
import ActivityFormPage from "@/components/activities/activity-form-page";

export default function EditActivityPage() {
  const { group, activity, loading } = useGroupActivityPage();

  if (loading)
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!group || !activity) return null;

  return <ActivityFormPage group={group} activity={activity} />;
}
