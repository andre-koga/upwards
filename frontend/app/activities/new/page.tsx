import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import NewGroupForm from "@/components/activities/new-group-form";

async function NewGroupContent() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  return <NewGroupForm userId={uid} />;
}

export default async function NewGroupPage() {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <NewGroupContent />
      </Suspense>
    </main>
  );
}
