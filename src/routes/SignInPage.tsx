/**
 * @deprecated
 * PRESERVED FOR FUTURE USE / REFERENCE
 * Superseded by SignInPageV2.tsx (canonical authenticated admin sign-in).
 * DO NOT DELETE — Can be reactivated if requested.
 */
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";

export function SignInPage() {
  const navigate = useNavigate();
  const { dispatch } = useAppContext();
  const { t } = useTranslation();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: "set-admin-auth", value: true });
    navigate("/admin");
  }

  return (
    <section className="hero-panel glass-panel compact sign-in-panel">
      <div className="hero-copy">
        <p className="eyebrow">Restricted route</p>
        <h2>{t("signIn")}</h2>
        <p>This placeholder screen represents Firebase-authenticated maintenance access in v1.</p>
      </div>
      <form className="sign-in-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input type="email" defaultValue="admin@ecolocker.local" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" defaultValue="password" required />
        </label>
        <button className="primary-button" type="submit">
          Authenticate
        </button>
      </form>
    </section>
  );
}