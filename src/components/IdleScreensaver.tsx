import { useEffect, useState } from "react";
import { useTranslation } from "../store/useTranslation";

const IDLE_TIMEOUT_MS = 70000;

export function IdleScreensaver() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout = 0;

    const reset = () => {
      window.clearTimeout(timeout);
      setVisible(false);
      timeout = window.setTimeout(() => setVisible(true), IDLE_TIMEOUT_MS);
    };

    reset();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "pointermove", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));

    return () => {
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="idle-screensaver" onPointerDown={() => setVisible(false)} aria-hidden="true">
      <video className="idle-screensaver-video" autoPlay muted loop playsInline preload="auto">
        <source src="/logo-intro.mp4" type="video/mp4" />
      </video>
      <div className="idle-screensaver-fallback">
        <div className="idle-screensaver-box" />
        <div className="idle-screensaver-copy">
          <h2>{t("brand")}</h2>
          <p>{t("modeTitle")}</p>
        </div>
      </div>
    </div>
  );
}
