import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import TimerPageContent from "@/components/timer/timer-page-content";

async function TimerContent() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  return <TimerPageContent userId={uid} />;
}

export default async function TimerPage() {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading timer...</p>
          </div>
        }
      >
        <TimerContent />
      </Suspense>
    </main>
  );
}
