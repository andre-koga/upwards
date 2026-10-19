import type { AccountSettings } from "@/lib/account-settings";

/**
 * The two choices Upwards asks about once (product-scope.md §2.5, §2.7). Both
 * are off until chosen, and both live in Settings afterwards, so this is a
 * friendly place to decide, never the only one.
 */
const SETUP_QUESTIONS = ["autoLocation", "dailyClip"] as const;
export type SetupQuestion = (typeof SETUP_QUESTIONS)[number];

interface SetupState {
  settings: AccountSettings;
  /** The account's own settings have been read on this device. */
  accountHasAnswered: boolean;
  /** Something else is already asking for the person's full attention. */
  blocked: boolean;
}

/**
 * What is still worth asking. `null` is "never chosen"; an explicit `false` is
 * a choice and is never asked about again.
 *
 * Nothing is asked until the account has answered: on a new device the local
 * copy is empty, and asking then would re-ask someone who already chose on
 * another. Offline at first sign-in the account cannot answer, so the answer
 * is "nothing yet" rather than a guess.
 */
export function pendingSetupQuestions(state: SetupState): SetupQuestion[] {
  if (!state.accountHasAnswered || state.blocked) return [];
  return SETUP_QUESTIONS.filter(
    (question) => state.settings[question] === null
  );
}

/** What the person picked for each question; unpicked ones are recorded as off. */
export function setupAnswersToSettings(
  asked: readonly SetupQuestion[],
  picked: ReadonlySet<SetupQuestion>
): Partial<AccountSettings> {
  const patch: Partial<AccountSettings> = {};
  for (const question of asked) patch[question] = picked.has(question);
  return patch;
}
