import { useGroupPage } from "@/hooks/use-group-page";
import EditGroupForm from "@/components/activities/edit-group-form";

export default function EditGroupPage() {
  const { group, loading } = useGroupPage();

  if (loading)
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!group) return null;

  return <EditGroupForm group={group} />;
}
