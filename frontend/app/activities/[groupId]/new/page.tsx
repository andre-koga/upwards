import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import NewActivityForm from "@/components/activities/new-activity-form";

interface NewActivityPageProps {
  params: Promise<{
    groupId: string;
  }>;
}

async function NewActivityContent({ groupId }: { groupId: string }) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  // Fetch the group to make sure it exists and belongs to the user
  const { data: group, error: groupError } = await supabase
    .from("activity_groups")
    .select("*")
    .eq("id", groupId)
    .eq("user_id", uid)
    .maybeSingle();

  if (groupError || !group) {
    notFound();
  }

  return <NewActivityForm userId={uid} group={group} />;
}

export default async function NewActivityPage({
  params,
}: NewActivityPageProps) {
  const { groupId } = await params;

  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <NewActivityContent groupId={groupId} />
      </Suspense>
    </main>
  );
}
