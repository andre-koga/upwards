import { useUserProfile } from "@/lib/use-user-profile";
import type { LocaleValue } from "@/lib/i18n/locale-storage";

/** Read/write the active app locale with localStorage + profile sync when signed in. */
export function useLocale(): {
  locale: LocaleValue;
  setLocale: (locale: LocaleValue) => void;
  loading: boolean;
} {
  const { locale, setLocale, loading } = useUserProfile();
  return { locale, setLocale, loading };
}
