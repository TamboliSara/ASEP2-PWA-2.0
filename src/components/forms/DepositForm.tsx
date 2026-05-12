import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Shield } from "lucide-react";
import { useAppContext } from "../../store/AppContext";
import { useTranslation } from "../../store/useTranslation";
import { AppleFaceIDScanner } from "../AppleFaceIDScanner";

export function DepositForm({ 
  onSubmit, 
  isBusy = false,
  isNaked = false,
  onShowSafety
}: { 
  onSubmit: (imageData?: string) => Promise<void>; 
  isBusy?: boolean;
  isNaked?: boolean;
  onShowSafety?: () => void;
}) {
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isVerified, setIsVerified] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone: string) => /^\d{10}$/.test(phone.replace(/\D/g, ""));

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

    setValidationError(null);
    dispatch({
      type: "set-donation-draft",
      draft: {
        [name]: value
      }
    });
  }

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  async function handleSubmit(event: FormEvent, imageData?: string) {
    event.preventDefault();
    setValidationError(null);

    if (currentStep === 1) {
      if (!state.donationDraft.foodName?.trim() || !state.donationDraft.categoryId) {
        setValidationError(t("errorFillAllFields"));
        return;
      }
    }

    if (currentStep === 3) {
      const { donorName, donorContact } = state.donationDraft;
      if (!donorName?.trim()) {
        setValidationError(t("errorNameRequired"));
        return;
      }
      if (!donorContact?.trim()) {
        setValidationError(t("errorContactRequired"));
        return;
      }

      const isMaybeEmail = donorContact.includes("@");
      const isMaybePhone = /^\d+$/.test(donorContact.replace(/[\s-()]/g, ""));

      if (isMaybeEmail) {
        if (!validateEmail(donorContact)) {
          setValidationError(t("errorInvalidEmail"));
          return;
        }
      } else if (isMaybePhone) {
        const digits = donorContact.replace(/\D/g, "");
        if (digits.length !== 10) {
          setValidationError(t("errorInvalidPhone"));
          return;
        }
      } else {
        setValidationError(t("errorInvalidContact"));
        return;
      }
    }

    if (currentStep < 4) {
      nextStep();
    }
  }

  return (
    <form 
      className={`deposit-form ${isNaked ? "is-naked" : "glass-panel-premium"}`} 
      onSubmit={handleSubmit}
      style={isNaked ? { background: 'none', border: 'none', boxShadow: 'none', padding: '1rem 1rem' } : {}}
    >
      <div className="form-header-premium" style={{ marginBottom: '1.5rem' }}>
        <div className="step-indicator-luxe" style={{ marginBottom: '1.5rem', maxWidth: '400px' }}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`step-dot-luxe ${currentStep === s ? "is-active" : s < currentStep ? "is-complete" : ""}`} style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}>
              <div className="dot-core">{s}</div>
              <div className="dot-glow" />
            </div>
          ))}
          <div className="step-progress-line" style={{ left: '18px', right: '18px' }}>
            <div className="progress-fill" style={{ width: `${((currentStep - 1) / 3) * 100}%` }} />
          </div>
        </div>
        <div className="form-heading-luxe relative text-center">
          <div className="flex flex-col items-center">
            <p className="eyebrow-accent">{t("step") || "Step"} {currentStep} of 4</p>
            <h2 className="gradient-text-luxe" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
              {currentStep === 1 ? t("foodDetails") || "Food Details" : 
               currentStep === 2 ? t("allergyInfo") || "Safety & Allergens" : 
               currentStep === 3 ? t("confirmDeposit") || "Donor Details" :
               "Donor Authentication"}
            </h2>
          </div>
          
          {onShowSafety && (
            <button 
              type="button"
              onClick={onShowSafety}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all shadow-sm"
              title="Review Safety Guidelines"
            >
              <Shield className="w-5 h-5" />
            </button>
          )}

          <p className="heading-subtext mx-auto" style={{ fontSize: '0.95rem', maxWidth: '40ch' }}>
            {currentStep === 1 ? t("foodDetailsBody") || "Tell us what you are sharing today." :
             currentStep === 2 ? t("allergyInfoBody") || "Important safety information for receivers." :
             currentStep === 3 ? t("confirmDepositBody") || "Review your donation details." :
             "Secure biometric verification required."}
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

        {currentStep === 4 && (
          <div className="animate-luxe-entry" style={{ padding: '1rem 0' }}>
            <AppleFaceIDScanner onVerify={(img) => onSubmit(img)} />
          </div>
        )}

        {validationError && (
          <div className="animate-luxe-entry" style={{ 
            marginTop: '1rem', 
            padding: '0.75rem 1rem', 
            borderRadius: '0.75rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: '#ef4444',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            {validationError}
          </div>
        )}
      </div>

      <div className="form-actions-luxe" style={{ marginTop: '2rem' }}>
        {currentStep > 1 && currentStep < 4 && (
          <button className="luxe-secondary-button" type="button" onClick={prevStep} disabled={isBusy} style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
            <span className="btn-icon">←</span>
            {t("back") || "Back"}
          </button>
        )}
        {currentStep < 3 && (
          <button className="luxe-primary-button" type="submit" disabled={isBusy} style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
            {isBusy ? t("submittingDeposit") : t("continue") || "Continue"}
            <span className="btn-icon">→</span>
          </button>
        )}
        {currentStep === 3 && (
          <button className="luxe-primary-button" type="submit" disabled={isBusy} style={{ padding: '0.75rem 2rem', fontSize: '1rem', background: 'linear-gradient(135deg, var(--accent) 0%, #10B981 100%)' }}>
            {isBusy ? t("submittingDeposit") : "Proceed to Verification"}
            <span className="btn-icon">→</span>
          </button>
        )}
      </div>
    </form>
  );
}
