import { getCachedUserId, supabase } from "@/lib/supabase";
import { clearLetterCache } from "./letter-cache";

/** Deletes the stored letter and this device's copy. Does not touch the journal. */
export async function clearJournalLetters(): Promise<void> {
  clearLetterCache();
  const userId = getCachedUserId();
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("journal_letters")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
