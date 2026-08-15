import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminPageV2 } from "./routes/AdminPageV2";
import { ConnectPage } from "./routes/ConnectPage";
import { DonorPage } from "./routes/DonorPage";
import { KioskPage } from "./routes/KioskPage";
import { ModeSelectPage } from "./routes/ModeSelectPage";
import { SignInPageV2 } from "./routes/SignInPageV2";
import { LandingPage } from "./routes/LandingPage";
import { VisualizerPage } from "./routes/VisualizerPage";
import { DemoOne } from "./components/demo";
import AlertDemo from "./components/ui/alert-demo";

import { useAppContext } from "./store/AppContext";
import { syncNavigationEvent } from "./services/initialSync";

export default function App() {
  const { state, dispatch } = useAppContext();
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "SAFE — Select Mode",
      "/donate": "SAFE — Donor Mode",
      "/receive": "SAFE — Receiver Dashboard",
      "/admin": "SAFE — Admin Panel",
      "/admin/sign-in": "SAFE — Sign In",
      "/connect": "SAFE — Connect"
    };
    document.title = titles[location.pathname] || "SAFE";

    // Track every navigation in Firestore events/
    if (prevPath.current !== location.pathname) {
      syncNavigationEvent(prevPath.current, location.pathname);
      prevPath.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleToggleTheme = () => {
      dispatch({
        type: "set-theme-mode",
        themeMode: state.themeMode === "dark" ? "light" : "dark"
      });
    };
    const handleSetLight = () => dispatch({ type: "set-theme-mode", themeMode: "light" });
    const handleSetDark = () => dispatch({ type: "set-theme-mode", themeMode: "dark" });

    window.addEventListener('toggle-theme', handleToggleTheme);
    window.addEventListener('set-theme-light', handleSetLight);
    window.addEventListener('set-theme-dark', handleSetDark);
    
    return () => {
      window.removeEventListener('toggle-theme', handleToggleTheme);
      window.removeEventListener('set-theme-light', handleSetLight);
      window.removeEventListener('set-theme-dark', handleSetDark);
    };
  }, [state.themeMode, dispatch]);

  return (
    <AppShell>
      <Routes>
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/" element={state.hasCompletedPairing ? <ModeSelectPage /> : <Navigate to="/connect" replace />} />
        <Route path="/donate" element={state.hasCompletedPairing ? <DonorPage /> : <Navigate to="/connect" replace />} />
        <Route path="/receive" element={<KioskPage />} />
        <Route path="/public" element={<Navigate to="/receive" replace />} />
        <Route path="/admin" element={state.hasCompletedPairing ? <AdminPageV2 /> : <Navigate to="/connect" replace />} />
        <Route path="/admin/sign-in" element={state.hasCompletedPairing ? <SignInPageV2 /> : <Navigate to="/connect" replace />} />
        <Route path="/welcome" element={state.hasCompletedPairing ? <LandingPage /> : <Navigate to="/connect" replace />} />
        <Route path="/demo" element={<DemoOne />} />
        <Route path="/visualizer" element={<VisualizerPage />} />
        <Route path="/demo/alerts" element={<AlertDemo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
