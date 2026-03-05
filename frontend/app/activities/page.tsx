import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ActivitiesList from "@/components/activities/activities-list";

async function ActivitiesContent() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  return <ActivitiesList userId={uid} />;
}

export default async function ActivitiesPage() {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        }
      >
        <ActivitiesContent />
      </Suspense>
    </main>
  );
}
