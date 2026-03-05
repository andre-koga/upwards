import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ActivityNavMenu from "@/components/activities/activity-nav-menu";

export default async function ActivityStatsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen p-4 pb-36">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Activity Stats</h1>
          <p className="text-muted-foreground">
            Insights and trends for your activities
          </p>
        </div>
      </div>
      <ActivityNavMenu />
    </div>
  );
}
