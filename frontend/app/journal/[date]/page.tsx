import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import JournalForm from "@/components/journal/journal-form";
import JournalView from "@/components/journal/journal-view";

interface JournalPageProps {
  params: Promise<{
    date: string;
  }>;
  searchParams: Promise<{
    edit?: string;
  }>;
}

async function JournalContent({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { date } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    redirect("/");
  }

  // Calculate if this entry can be edited (within last 7 days)
  const today = new Date();
  const entryDate = new Date(date);
  const diffTime = today.getTime() - entryDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const canEdit = diffDays <= 7;

  // Fetch existing journal entry for this date
  const { data: journalEntry } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", uid)
    .eq("entry_date", date)
    .single();

  // Determine initial mode: edit only if ?edit=true or there's no entry yet, otherwise view
  const initialMode = edit === "true" || !journalEntry ? "edit" : "view";

  return (
    <div className="min-h-screen px-4 py-4 pb-24">
      <div className="max-w-2xl mx-auto">
        {initialMode === "view" ? (
          <JournalView entry={journalEntry!} canEdit={canEdit} />
        ) : (
          <JournalForm
            userId={uid}
            date={date}
            existingEntry={journalEntry}
            canEdit={canEdit}
            initialMode={initialMode}
          />
        )}
      </div>
    </div>
  );
}

export default async function JournalPage({
  params,
  searchParams,
}: JournalPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading journal entry...</p>
        </div>
      }
    >
      <JournalContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
