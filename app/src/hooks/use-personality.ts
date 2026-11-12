import { useAsyncData } from "@/hooks/use-async-data";
import type { JournalReading, PersonalitySitting } from "@/lib/db/types";
import { latestJournalReading } from "@/lib/personality/journal-reading";
import { completedSittings, currentSitting } from "@/lib/personality/store";

export interface PersonalityData {
  /** The sitting being answered, if one was started and not finished. */
  current: PersonalitySitting | null;
  /** Finished sittings, newest first. */
  completed: PersonalitySitting[];
  reading: JournalReading | null;
}

/** Everything the You page shows, read from this device. */
export function usePersonality() {
  return useAsyncData<PersonalityData>(async () => {
    const [current, completed, reading] = await Promise.all([
      currentSitting(),
      completedSittings(),
      latestJournalReading(),
    ]);
    return { current, completed, reading };
  }, []);
}
