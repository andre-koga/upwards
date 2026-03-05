import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import EditActivityForm from "@/components/activities/edit-activity-form";

interface EditActivityPageProps {
  params: Promise<{
    groupId: string;
    activityId: string;
  }>;
}

async function EditActivityContent({
  groupId,
  activityId,
}: {
  groupId: string;
  activityId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  // Fetch the group
  const { data: group, error: groupError } = await supabase
    .from("activity_groups")
    .select("*")
    .eq("id", groupId)
    .eq("user_id", uid)
    .maybeSingle();

  if (groupError || !group) {
    notFound();
  }

  // Fetch the activity
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .eq("user_id", uid)
    .eq("group_id", groupId)
    .maybeSingle();

  if (activityError || !activity) {
    notFound();
  }

  return <EditActivityForm userId={uid} group={group} activity={activity} />;
}

export default async function EditActivityPage({
  params,
}: EditActivityPageProps) {
  const { groupId, activityId } = await params;

  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <EditActivityContent groupId={groupId} activityId={activityId} />
      </Suspense>
    </main>
  );
}
