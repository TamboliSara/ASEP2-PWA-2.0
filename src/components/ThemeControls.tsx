import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import type { ThemePalette } from "../types/domain";

export function ThemeControls() {
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();

  return (
    <div className="theme-controls">
      <button
        type="button"
        className="mode-toggle"
        aria-label={t("themeToggle")}
        onClick={() =>
          dispatch({
            type: "set-theme-mode",
            themeMode: state.themeMode === "dark" ? "light" : "dark"
          })
        }
      >
        {state.themeMode === "dark" ? t("lightMode") : t("darkMode")}
      </button>
    </div>
  );
}
