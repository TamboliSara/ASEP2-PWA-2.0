import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";

export function SignInPageV2() {
  const navigate = useNavigate();
  const { dispatch } = useAppContext();
  const { t } = useTranslation();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: "set-admin-auth", value: true });
    navigate("/admin");
  }

  return (
    <div className="split-layout">
      <div className="split-visual">
        <div className="split-visual-content">
          <p className="eyebrow">{t("restrictedRoute")}</p>
          <h2>{t("brand") || "EcoLocker"}</h2>
          <p>{t("brandTagline") || "Community-Powered Freshness"}</p>
          
          <div className="visual-locker-orb" style={{
            width: '200px',
            height: '200px',
            margin: '2rem auto',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            opacity: 0.4,
            filter: 'blur(20px)',
            animation: 'glowPulse 4s infinite alternate'
          }} />
        </div>
      </div>
      
      <section className="split-form-side">
        <div className="form-header">
          <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{t("signIn")}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{t("signInBody")}</p>
        </div>

        <form className="sign-in-form" onSubmit={handleSubmit}>
          <label>
            <span>{t("email")}</span>
            <input type="email" defaultValue="admin@ecolocker.local" required />
          </label>
          <label>
            <span>{t("password")}</span>
            <input type="password" defaultValue="password" required />
          </label>
          <button className="primary-button" type="submit">
            {t("authenticate")}
          </button>
        </form>
        
        <p className="footer-note" style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '2rem' }}>
          {t("adminSignInBody")}
        </p>
      </section>
    </div>
  );
}
