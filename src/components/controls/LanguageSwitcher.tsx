import { useAppContext } from "../../store/AppContext";
import { useTranslation } from "../../store/useTranslation";
import type { LocaleCode } from "../../types/domain";

const locales: LocaleCode[] = ["en", "hi", "mr"];

export function LanguageSwitcher() {
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();

  return (
    <div className="segmented-control" aria-label={t("languageLabel")}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          className={locale === state.locale ? "is-active" : ""}
          onClick={() => dispatch({ type: "set-locale", locale })}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
