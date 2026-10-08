import { useMemo } from "react";
import { translationsV3 } from "../locales/translationsV3";
import { useAppContext } from "../store/AppContext";
import type { LocaleCode } from "../types/domain";

export interface TranslationHookResult {
  locale: LocaleCode;
  t: (key: string, defaultText?: string) => string;
}

export function useTranslation(): TranslationHookResult {
  const { state } = useAppContext();

  return useMemo(() => {
    const dictionary = translationsV3[state.locale];
    const fallback = translationsV3.en;
    return {
      locale: state.locale,
      t: (key: string, defaultText?: string): string => dictionary[key] ?? fallback[key] ?? defaultText ?? key
    };
  }, [state.locale]);
}
