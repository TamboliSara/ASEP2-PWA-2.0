import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAppContext } from "../../store/AppContext";
import { useTranslation } from "../../store/useTranslation";

export function DepositForm({ onSubmit, isBusy = false }: { onSubmit: () => Promise<void>; isBusy?: boolean }) {
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);

  const categories = useMemo(
    () => [
      { id: 1, label: t("categoryRawProduce") },
      { id: 2, label: t("categoryCookedMeal") },
      { id: 3, label: t("categoryDairyLiquid") },
      { id: 4, label: t("categoryBakedGoods") }
    ],
    [t]
  );
  const diets = useMemo(
    () => [
      { value: "veg", label: t("dietVeg") },
      { value: "non_veg", label: t("dietNonVeg") },
      { value: "vegan", label: t("dietVegan") }
    ] as const,
    [t]
  );

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    if (name === "categoryId") {
      const category = categories.find((item) => item.id === Number(value));
      dispatch({
        type: "set-donation-draft",
        draft: {
          categoryId: Number(value),
          categoryLabel: category?.label ?? ""
        }
      });
      return;
    }

    dispatch({
      type: "set-donation-draft",
      draft: {
        [name]: value
      }
    });
  }

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (currentStep < 3) {
      nextStep();
    } else {
      await onSubmit();
    }
  }

  return (
    <form className="deposit-form glass-panel-premium" onSubmit={handleSubmit}>
      <div className="form-header-premium">
        <div className="step-indicator-luxe">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`step-dot-luxe ${currentStep === s ? "is-active" : s < currentStep ? "is-complete" : ""}`}>
              <div className="dot-core">{s}</div>
              <div className="dot-glow" />
            </div>
          ))}
          <div className="step-progress-line">
            <div className="progress-fill" style={{ width: `${((currentStep - 1) / 2) * 100}%` }} />
          </div>
        </div>
        <div className="form-heading-luxe">
          <p className="eyebrow-accent">{t("step") || "Step"} {currentStep} of 3</p>
          <h2 className="gradient-text-luxe">
            {currentStep === 1 ? t("foodDetails") || "Food Details" : 
             currentStep === 2 ? t("allergyInfo") || "Safety & Allergens" : 
             t("confirmDeposit") || "Finalize Deposit"}
          </h2>
          <p className="heading-subtext">
            {currentStep === 1 ? t("foodDetailsBody") || "Tell us what you are sharing today." :
             currentStep === 2 ? t("allergyInfoBody") || "Important safety information for receivers." :
             t("confirmDepositBody") || "Review your donation and complete the deposit."}
          </p>
        </div>
      </div>

      <div className="form-content-luxe">
        {currentStep === 1 && (
          <div className="form-grid-luxe animate-luxe-entry">
            <label className="premium-field">
              <span className="field-label">{t("foodName")}</span>
              <input 
                className="premium-input"
                name="foodName" 
                value={state.donationDraft.foodName} 
                onChange={updateField} 
                required 
                placeholder="e.g. Fresh Garden Salad" 
              />
            </label>
            <label className="premium-field">
              <span className="field-label">{t("category")}</span>
              <select 
                className="premium-select"
                name="categoryId" 
                value={state.donationDraft.categoryId ?? ""} 
                onChange={updateField} 
                required
              >
                <option value="">{t("selectOne")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </label>
            <label className="premium-field span-2">
              <span className="field-label">{t("dietTag")}</span>
              <select 
                className="premium-select"
                name="dietTag" 
                value={state.donationDraft.dietTag} 
                onChange={updateField}
              >
                {diets.map((diet) => (
                  <option key={diet.value} value={diet.value}>{diet.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {currentStep === 2 && (
          <div className="form-grid-luxe animate-luxe-entry">
            <label className="premium-field span-2">
              <span className="field-label">{t("allergensNotes")}</span>
              <textarea 
                className="premium-input is-textarea"
                name="allergensNotes" 
                value={state.donationDraft.allergensNotes} 
                onChange={updateField} 
                rows={5} 
                placeholder="Mention any allergens like nuts, dairy, gluten, etc."
              />
            </label>
          </div>
        )}

        {currentStep === 3 && (
          <div className="form-grid-luxe animate-luxe-entry">
            <label className="premium-field">
              <span className="field-label">{t("donorName")}</span>
              <input 
                className="premium-input"
                name="donorName" 
                value={state.donationDraft.donorName} 
                onChange={updateField} 
                required 
                placeholder="Your name" 
              />
            </label>
            <label className="premium-field">
              <span className="field-label">{t("donorContact")}</span>
              <input 
                className="premium-input"
                name="donorContact" 
                value={state.donationDraft.donorContact} 
                onChange={updateField} 
                required 
                placeholder="Phone or email" 
              />
            </label>
            <div className="span-2 summary-card-premium">
              <p className="summary-label">{t("reviewDetails") || "Review Details"}</p>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">{t("foodName") || "Food Item"}</span>
                  <span className="value">{state.donationDraft.foodName}</span>
                </div>
                <div className="summary-item">
                  <span className="label">{t("category") || "Category"}</span>
                  <span className="value">{state.donationDraft.categoryLabel}</span>
                </div>
                <div className="summary-item">
                  <span className="label">{t("dietPreference") || "Diet"}</span>
                  <span className="value">{diets.find(d => d.value === state.donationDraft.dietTag)?.label || "-"}</span>
                </div>
                <div className="summary-item">
                  <span className="label">{t("allergens") || "Allergens"}</span>
                  <span className="value">{state.donationDraft.allergensNotes || "None declared"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="form-actions-luxe">
        {currentStep > 1 && (
          <button className="luxe-secondary-button" type="button" onClick={prevStep} disabled={isBusy}>
            <span className="btn-icon">←</span>
            {t("back") || "Back"}
          </button>
        )}
        <button className="luxe-primary-button" type="submit" disabled={isBusy}>
          {isBusy ? t("submittingDeposit") : currentStep === 3 ? t("completeDeposit") || "Complete Deposit" : t("continue") || "Continue"}
          <span className="btn-icon">→</span>
        </button>
      </div>
    </form>
  );
}

