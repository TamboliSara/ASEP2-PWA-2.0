import { useMemo } from "react";
import { translationsV3 } from "../locales/translationsV3";
import { useAppContext } from "../store/AppContext";

export function useTranslation() {
  const { state } = useAppContext();

  return useMemo(() => {
    const dictionary = translationsV3[state.locale];
    const fallback = translationsV3.en;
    return {
      locale: state.locale,
      t: (key: string, defaultText?: string) => dictionary[key] ?? fallback[key] ?? defaultText ?? key
    };
  }, [state.locale]);
}
