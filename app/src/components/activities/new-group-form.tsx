import { useNavigate } from "react-router-dom";
import { db, now, newId } from "@/lib/db";
import GroupFormFields from "./group-form-fields";

export default function NewGroupForm() {
  const navigate = useNavigate();

  const handleSubmit = async (data: { name: string; color: string }) => {
    const n = now();
    await db.activityGroups.add({
      id: newId(),
      name: data.name,
      color: data.color,
      is_archived: false,
      order_index: null,
      created_at: n,
      updated_at: n,
      synced_at: null,
      deleted_at: null,
    });
    navigate("/activities");
  };

  return (
    <GroupFormFields
      title="Create New Activity Group"
      submitLabel="Create Group"
      initialData={{ name: "" }}
      onSubmit={handleSubmit}
    />
  );
}
