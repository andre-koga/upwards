import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import ArchivedItems from "@/components/activities/archived-items";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

async function ArchivedContent() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Archived Items</h1>
          <p className="text-muted-foreground">
            Manage your archived activity groups and activities. You can
            unarchive items to restore them, or permanently delete them.
          </p>
        </div>
        <ArchivedItems userId={uid} />
      </div>
    </div>
  );
}

export default async function ArchivedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading archived items...</p>
        </div>
      }
    >
      <ArchivedContent />
    </Suspense>
  );
}
