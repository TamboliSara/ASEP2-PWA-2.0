import { Hero } from "../components/ui/animated-hero";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../store/AppContext";

export function LandingPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();

  return (
    <div className="min-h-screen bg-bg">
      <Hero />
      <div className="container mx-auto px-6 py-12 flex justify-center">
        <button 
          className="primary-button text-lg px-12 py-4"
          onClick={() => navigate(state.hasCompletedPairing ? "/" : "/connect")}
        >
          Enter the App
        </button>
      </div>
    </div>
  );
}
