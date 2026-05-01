import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FoodHeroV2 } from "../components/FoodHeroV2";
import { DepositForm } from "../components/forms/DepositForm";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { useLockerController } from "../features/useLockerController";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";

export function DonorPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentLocker, submitDeposit, isBusy } = useLockerController();
  const { t } = useTranslation();
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const donorSteps = [t("donorStep1"), t("donorStep2"), t("donorStep3"), t("donorStep4")];

  async function handleSubmit() {
    const donation = await submitDeposit();
    setDepositConfirmed(true);
    if (donation) {
      window.setTimeout(() => navigate("/receive", { replace: true }), 900);
    }
  }

  return (
    <div className="page-grid donor-grid">
      <div className="page-navigation-top">
        <Link to="/" className="ghost-button">
          ← {t("backToHome") || "Back to Home"}
        </Link>
      </div>

      <section className="hero-panel donor-hero glass-panel">
        <div className="hero-copy">
          <p className="eyebrow">{t("donorEyebrow")}</p>
          <h2>{t("donorTitle")}</h2>
          <p>{t("donorBody")}</p>
          {depositConfirmed || state.syncMessage ? (
            <div className="status-banner">{depositConfirmed ? t("depositSuccessBanner") : state.syncMessage}</div>
          ) : null}
        </div>
        <FoodHeroV2
          donation={{
            ...(currentLocker.activeDonation ?? {
              id: "draft",
              lockerId: currentLocker.lockerId,
              createdAt: new Date().toISOString(),
              latestQualityScore: currentLocker.foodQualityScore,
              deadlineEstimate: currentLocker.deadlineEstimate,
              syncState: "idle"
            }),
            foodName: state.donationDraft.foodName || t("incomingMeal"),
            categoryId: state.donationDraft.categoryId ?? 0,
            categoryLabel: state.donationDraft.categoryLabel || t("selectCategory"),
            donorName: state.donationDraft.donorName || "",
            donorContact: state.donationDraft.donorContact || "",
            allergensNotes: state.donationDraft.allergensNotes || "",
            dietTag: state.donationDraft.dietTag
          }}
        />
      </section>

      <section className="donor-flow-container" style={{ maxWidth: '560px', margin: '0 auto', width: '100%' }}>
        <DepositForm onSubmit={handleSubmit} isBusy={isBusy} />
      </section>

    </div>
  );
}
