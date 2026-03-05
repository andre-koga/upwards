import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import EditGroupForm from "@/components/activities/edit-group-form";

interface EditGroupPageProps {
  params: Promise<{
    groupId: string;
  }>;
}

async function EditGroupContent({ groupId }: { groupId: string }) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  const { data: group, error: groupError } = await supabase
    .from("activity_groups")
    .select("*")
    .eq("id", groupId)
    .eq("user_id", uid)
    .maybeSingle();

  if (groupError || !group) {
    notFound();
  }

  return <EditGroupForm group={group} />;
}

export default async function EditGroupPage({ params }: EditGroupPageProps) {
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
        <EditGroupContent groupId={groupId} />
      </Suspense>
    </main>
  );
}
