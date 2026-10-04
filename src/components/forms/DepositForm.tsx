import { useMemo, useState, Suspense, lazy } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Shield } from "lucide-react";
import { useAppContext } from "../../store/AppContext";
import { useTranslation } from "../../store/useTranslation";
const AppleFaceIDScanner = lazy(() => import("../../features/biometrics/AppleFaceIDScanner").then(m => ({ default: m.AppleFaceIDScanner })));
import { QrDonorVerifier } from "../../features/verification/QrDonorVerifier";

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

  function handleContactChange(event: ChangeEvent<HTMLInputElement>) {
    setValidationError(null);
    const cleaned = event.target.value.replace(/\D/g, "").slice(0, 10);
    dispatch({
      type: "set-donation-draft",
      draft: {
        donorContact: cleaned,
        isPhoneVerified: false,
        otpVerifiedAt: undefined
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
      const { donorName, donorContact, isPhoneVerified } = state.donationDraft;
      if (!donorName?.trim()) {
        setValidationError(t("errorNameRequired"));
        return;
      }
      if (!donorContact?.trim()) {
        setValidationError(t("errorContactRequired"));
        return;
      }

      const digits = donorContact.replace(/\D/g, "");
      if (digits.length !== 10) {
        setValidationError(t("errorInvalidPhone") || "Phone number must be exactly 10 digits.");
        return;
      }

      if (!isPhoneVerified) {
        setValidationError(t("scanQrStep3") || "Please scan the QR code and enter the 6-digit passkey before proceeding.");
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
      style={isNaked ? { background: 'none', border: 'none', boxShadow: 'none', padding: '0', minHeight: 'unset', gap: '0.65rem' } : {}}
    >
      <div className="form-header-premium" style={{ marginBottom: isNaked ? '0.3rem' : '0.6rem' }}>
        <div className="step-indicator-luxe" style={{ marginBottom: isNaked ? '0.45rem' : '0.6rem', maxWidth: isNaked ? '260px' : '280px' }}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`step-dot-luxe ${currentStep === s ? "is-active" : s < currentStep ? "is-complete" : ""}`} style={{ width: isNaked ? '26px' : '26px', height: isNaked ? '26px' : '26px', fontSize: isNaked ? '0.75rem' : '0.75rem' }}>
              <div className="dot-core">{s}</div>
              <div className="dot-glow" />
            </div>
          ))}
          <div className="step-progress-line" style={{ left: isNaked ? '13px' : '13px', right: isNaked ? '13px' : '13px' }}>
            <div className="progress-fill" style={{ width: `${((currentStep - 1) / 3) * 100}%` }} />
          </div>
        </div>
        <div className="form-heading-luxe relative text-center">
          <div className="flex flex-col items-center">
            <p className="eyebrow-accent" style={{ fontSize: isNaked ? '0.7rem' : '0.72rem', marginBottom: isNaked ? '0.12rem' : '0.2rem' }}>{t("step") || "Step"} {currentStep} / 4</p>
            <h2 className="gradient-text-luxe" style={{ fontSize: isNaked ? '1.4rem' : '1.45rem', marginBottom: isNaked ? '0.18rem' : '0.25rem' }}>
              {currentStep === 1 ? t("foodDetails") || "Food Details" : 
               currentStep === 2 ? t("allergyInfo") || "Safety & Allergens" : 
               currentStep === 3 ? t("confirmDeposit") || "Donor Details" :
               t("donorAuthentication") || "Donor Authentication"}
            </h2>
          </div>
          
          {onShowSafety && (
            <button 
              type="button"
              onClick={onShowSafety}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all shadow-sm"
              title="Review Safety Guidelines"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}

          <p className="heading-subtext mx-auto" style={{ fontSize: isNaked ? '0.84rem' : '0.88rem', maxWidth: '44ch' }}>
            {currentStep === 1 ? t("foodDetailsBody") || "Tell us what you are sharing today." :
             currentStep === 2 ? t("allergyInfoBody") || "Important safety information for receivers." :
             currentStep === 3 ? t("confirmDepositBody") || "Review your donation details." :
             t("donorAuthBody") || "Secure biometric verification required."}
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
            <label className="premium-field">
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
            <div className="premium-field step1-continue-field">
              <button 
                className="luxe-primary-button" 
                type="submit" 
                disabled={isBusy} 
                style={{ 
                  padding: isNaked ? '0.55rem 1.65rem' : '0.7rem 1.8rem', 
                  fontSize: isNaked ? '0.9rem' : '0.95rem',
                  height: 'fit-content'
                }}
              >
                {isBusy ? t("submittingDeposit") : t("continue") || "Continue"}
                <span className="btn-icon">→</span>
              </button>
            </div>
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
                rows={3} 
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
              <div className="premium-phone-input-wrap">
                <span className="phone-prefix-code">+91</span>
                <span className="phone-prefix-divider" aria-hidden="true" />
                <input 
                  className="phone-number-field"
                  name="donorContact" 
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={state.donationDraft.donorContact} 
                  onChange={handleContactChange} 
                  required 
                  placeholder="10-digit mobile number" 
                />
              </div>
            </label>

            {/* Dynamic QR Passkey Verification Section */}
            <div className="span-2">
              <QrDonorVerifier 
                phoneNumber={state.donationDraft.donorContact}
                donorName={state.donationDraft.donorName}
                isVerified={Boolean(state.donationDraft.isPhoneVerified)}
                onVerified={(verified, timestamp, ip) => {
                  setValidationError(null);
                  dispatch({
                    type: "set-donation-draft",
                    draft: {
                      isPhoneVerified: verified,
                      otpVerifiedAt: timestamp,
                      ...(ip ? { phoneIp: ip } : {})
                    }
                  });
                }}
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="animate-luxe-entry" style={{ padding: '1rem 0' }}>
            <Suspense fallback={<div className="p-8 text-center text-emerald-400 font-semibold text-sm">Initializing Face ID scanner...</div>}>
              <AppleFaceIDScanner onVerify={(img) => onSubmit(img)} />
            </Suspense>
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

      {currentStep > 1 && (
        <div className="form-actions-luxe" style={{ marginTop: isNaked ? '0.75rem' : '1.5rem' }}>
          {currentStep > 1 && currentStep < 4 && (
            <button className="luxe-secondary-button" type="button" onClick={prevStep} disabled={isBusy} style={{ padding: isNaked ? '0.55rem 1.4rem' : '0.7rem 1.5rem', fontSize: isNaked ? '0.9rem' : '0.95rem' }}>
              <span className="btn-icon">←</span>
              {t("back") || "Back"}
            </button>
          )}
          {currentStep === 2 && (
            <button className="luxe-primary-button" type="submit" disabled={isBusy} style={{ padding: isNaked ? '0.55rem 1.65rem' : '0.7rem 1.8rem', fontSize: isNaked ? '0.9rem' : '0.95rem' }}>
              {isBusy ? t("submittingDeposit") : t("continue") || "Continue"}
              <span className="btn-icon">→</span>
            </button>
          )}
        {currentStep === 3 && (
          <button 
            className="luxe-primary-button" 
            type="submit" 
            disabled={isBusy || !state.donationDraft.isPhoneVerified} 
            style={{ 
              padding: '0.55rem 1.6rem', 
              fontSize: '0.9rem', 
              background: state.donationDraft.isPhoneVerified 
                ? 'linear-gradient(135deg, var(--accent) 0%, #10B981 100%)' 
                : 'rgba(255, 255, 255, 0.08)',
              color: state.donationDraft.isPhoneVerified ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
              border: state.donationDraft.isPhoneVerified ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: state.donationDraft.isPhoneVerified ? 'pointer' : 'not-allowed',
              boxShadow: state.donationDraft.isPhoneVerified ? '0 10px 30px rgba(16, 185, 129, 0.25)' : 'none'
            }}
            title={!state.donationDraft.isPhoneVerified ? "Please verify with the QR passkey first" : undefined}
          >
            {isBusy ? t("submittingDeposit") : (
              state.donationDraft.isPhoneVerified ? (t("proceedToVerification") || "Proceed to Verification") : (t("verifyPhoneToProceed") || "Verify Phone to Proceed")
            )}
            <span className="btn-icon">→</span>
          </button>
        )}
      </div>
      )}
    </form>
  );
}
