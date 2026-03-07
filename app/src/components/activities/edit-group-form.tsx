import { useNavigate } from "react-router-dom";
import { db, now } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import GroupFormFields from "./group-form-fields";

interface EditGroupFormProps {
  group: ActivityGroup;
}

export default function EditGroupForm({ group }: EditGroupFormProps) {
  const navigate = useNavigate();

  const handleSubmit = async (data: { name: string; color: string }) => {
    await db.activityGroups.update(group.id, {
      name: data.name,
      color: data.color,
      updated_at: now(),
    });
    navigate(`/activities/${group.id}`);
  };

  return (
    <GroupFormFields
      submitLabel="Save Changes"
      initialData={{
        name: group.name || "",
        color: group.color || undefined,
      }}
      onSubmit={handleSubmit}
      backPath={`/activities/${group.id}`}
    />
  );
}
