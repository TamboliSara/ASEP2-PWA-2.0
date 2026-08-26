import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const transitionCopy: Record<string, { title: string; subtitle: string }> = {
  "/connect": {
    title: "Assembling locker systems",
    subtitle: "Glass shell, sensors, controller, and cloud bridge are coming online."
  },
  "/": {
    title: "Framing the next interaction",
    subtitle: "Preparing the kiosk for donor or receiver entry."
  },
  "/donate": {
    title: "Wrapping the meal in traceability",
    subtitle: "Building the donor flow around the next shared item."
  },
  "/receive": {
    title: "Sealing the active donation view",
    subtitle: "Projecting live chamber status, gas profile, and retrieval controls."
  },
  "/admin": {
    title: "Syncing the fleet canvas",
    subtitle: "Bringing locker states, alerts, and active donations into one board."
  }
};

export function RouteTransition() {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const copy = useMemo(() => transitionCopy[location.pathname] ?? transitionCopy["/"], [location.pathname]);

  useEffect(() => {
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 1150);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  if (!visible) {
    return null;
  }

  return (
    <div className="route-transition-overlay" aria-hidden="true">
      <div className="route-transition-card">
        <div className="transition-assembly">
          <span className="transition-panel transition-panel-top" />
          <span className="transition-panel transition-panel-left" />
          <span className="transition-panel transition-panel-right" />
          <span className="transition-panel transition-panel-bottom" />
          <span className="transition-core transition-core-phone" />
          <span className="transition-core transition-core-chip" />
          <span className="transition-core transition-core-sensor" />
          <span className="transition-orbit transition-orbit-a" />
          <span className="transition-orbit transition-orbit-b" />
          <span className="transition-orbit transition-orbit-c" />
        </div>
        <div className="transition-copy">
          <p className="eyebrow">EcoLocker transition</p>
          <h3>{copy.title}</h3>
          <p>{copy.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
