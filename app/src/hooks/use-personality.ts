import { useAsyncData } from "@/hooks/use-async-data";
import type { JournalReading, PersonalitySitting } from "@/lib/db/types";
import { loadBehaviour, type Behaviour } from "@/lib/personality/behaviour";
import { latestJournalReading } from "@/lib/personality/journal-reading";
import { completedSittings, currentSitting } from "@/lib/personality/store";

export interface PersonalityData {
  /** The sitting being answered, if one was started and not finished. */
  current: PersonalitySitting | null;
  /** Finished sittings, newest first. */
  completed: PersonalitySitting[];
  reading: JournalReading | null;
  /** What the habits and journal show, or null until there is enough. */
  behaviour: Behaviour | null;
}

/** Everything the You page shows, read from this device. */
export function usePersonality() {
  return useAsyncData<PersonalityData>(async () => {
    const [current, completed, reading, behaviour] = await Promise.all([
      currentSitting(),
      completedSittings(),
      latestJournalReading(),
      loadBehaviour(),
    ]);
    return { current, completed, reading, behaviour };
  }, []);
}
