import React, { Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ConnectPage } from "./routes/ConnectPage";
import { ModeSelectPage } from "./routes/ModeSelectPage";

const AdminPageV2 = lazy(() => import("./routes/AdminPageV2").then(m => ({ default: m.AdminPageV2 })));
const DonorPage = lazy(() => import("./routes/DonorPage").then(m => ({ default: m.DonorPage })));
const KioskPage = lazy(() => import("./routes/KioskPage").then(m => ({ default: m.KioskPage })));
const SignInPageV2 = lazy(() => import("./routes/SignInPageV2").then(m => ({ default: m.SignInPageV2 })));
const LandingPage = lazy(() => import("./routes/LandingPage").then(m => ({ default: m.LandingPage })));
const VisualizerPage = lazy(() => import("./routes/VisualizerPage").then(m => ({ default: m.VisualizerPage })));
const QrScanPage = lazy(() => import("./routes/QrScanPage").then(m => ({ default: m.QrScanPage })));
const DemoOne = lazy(() => import("./components/demo").then(m => ({ default: m.DemoOne })));
const AlertDemo = lazy(() => import("./components/ui/alert-demo"));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', gap: '0.75rem', color: '#10b981' }}>
      <div style={{ width: '24px', height: '24px', border: '3px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', opacity: 0.8 }}>LOADING...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

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
      "/connect": "SAFE — Connect",
      "/qr-scan": "SAFE — Donor Verification"
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/" element={<ModeSelectPage />} />
          <Route path="/donate" element={<DonorPage />} />
          <Route path="/receive" element={<KioskPage />} />
          <Route path="/public" element={<Navigate to="/receive" replace />} />
          <Route path="/admin" element={<AdminPageV2 />} />
          <Route path="/admin/sign-in" element={<SignInPageV2 />} />
          <Route path="/welcome" element={<LandingPage />} />
          {/* QR Scan landing — accessible without pairing (phone opens this) */}
          <Route path="/qr-scan" element={<QrScanPage />} />
          <Route path="/demo" element={<DemoOne />} />
          <Route path="/visualizer" element={<VisualizerPage />} />
          <Route path="/demo/alerts" element={<AlertDemo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
