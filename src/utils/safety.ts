import type { FoodQualityScore, LockerState } from "../types/domain";

export const MAX_SHELF_LIFE = 48; // Standard normalization hours

/**
 * Calculates the Quality Index % based on hours remaining.
 */
export function calculateQualityScore(hoursRemaining: number): number {
  return Math.min(100, Math.round((Math.max(0, hoursRemaining) / MAX_SHELF_LIFE) * 100));
}

/**
 * Maps a Quality Index % to a discrete category.
 * Safe (Fresh): QI >= 60%
 * Aging (Warning): 30% <= QI < 60%
 * Spoiled (Spoilt): QI < 30%
 */
export function getQualityStage(score: number): FoodQualityScore {
  if (score < 30) return "spoilt";
  if (score < 60) return "aging";
  return "fresh";
}

/**
 * Returns user-friendly labels for the 3 categories.
 */
export function getQualityLabel(stage: FoodQualityScore | "empty", locale: string = "en"): string {
  if (locale === "hi") {
    switch (stage) {
      case "fresh": return "ताज़ा";
      case "aging": return "मध्यम";
      case "spoilt": return "खराब";
      case "empty": return "खाली";
      default: return "अज्ञात";
    }
  }

  if (locale === "mr") {
    switch (stage) {
      case "fresh": return "ताजे";
      case "aging": return "मध्यम";
      case "spoilt": return "खराब";
      case "empty": return "रिकामा";
      default: return "अज्ञात";
    }
  }

  switch (stage) {
    case "fresh": return "Fresh";
    case "aging": return "Aging";
    case "spoilt": return "Spoiled";
    case "empty": return "Empty";
    default: return "Unknown";
  }
}

export function getRecommendedActions(locker: LockerState, locale: string = "en"): string[] {
  return getRecommendedActionsForQuality(locker.foodQualityScore, locale);
}

export function getRecommendedActionsForQuality(score: FoodQualityScore, locale: string = "en"): string[] {
  if (locale === "hi") {
    if (score === "spoilt") {
      return [
        "तत्काल कार्रवाई: सुरक्षित निपटान और सफाई के लिए टीम को सूचित करें।",
        "सतत डायवर्जन: समाप्त खाद्य सामग्री को जैविक खाद या जैव-अपशिष्ट संयंत्र में भेजें।",
        "पहुंच प्रतिबंधित: वितरण रोकने के लिए लॉक किया गया; व्यवस्थापक ओवरराइड आवश्यक है।"
      ];
    }
    if (score === "aging") {
      return [
        "आगामी संग्रह समय के भीतर शीघ्र भोजन प्राप्त करने को प्राथमिकता दें।",
        "सामुदायिक भोजन साझाकरण या 75°C से अधिक गर्म करके तेजी से उपयोग करें।",
        "यूनिट का वातावरण बनाए रखें: अगले चक्र से पहले चैंबर की नमी और VOC गैस संचय की निगरानी करें।"
      ];
    }
    return [
      "अनुकूल भंडारण अवधि: सुरक्षित संरक्षण मापदंड सक्रिय रूप से बनाए रखे गए हैं।",
      "संरक्षण सील: ताजगी बनाए रखने के लिए भोजन निकालने तक दरवाजा सीलबंद रखें।",
      "निरंतर निगरानी: खाद्य सुरक्षा ट्रेसेबिलिटी के लिए लाइव सेंसर टेलीमेट्री दर्ज की जा रही है।"
    ];
  }

  if (locale === "mr") {
    if (score === "spoilt") {
      return [
        "त्वरित कारवाई: सुरक्षित विल्हेवाटीसाठी स्वच्छता पथकाला सूचित करा.",
        "शाश्वत विल्हेवाट: मुदत संपलेले अन्न सेंद्रिय खतासाठी किंवा जैव-कचरा प्रकल्पात पाठवा.",
        "प्रवेश प्रतिबंधित: वाटप रोखण्यासाठी कुलूप लावले आहे; प्रशासक ओव्हरराइड आवश्यक आहे."
      ];
    }
    if (score === "aging") {
      return [
        "पुढील संकलन वेळेत त्वरित अन्न घेण्यास प्राधान्य द्या.",
        "सामुदायिक अन्न वाटप किंवा 75°C पेक्षा जास्त गरम करून जलद वापर करा.",
        "युनिटचे वातावरण राखा: पुढील चक्रापूर्वी कप्प्यातील आर्द्रता आणि VOC वायू संचय तपासा."
      ];
    }
    return [
      "अनुकूल साठवण कालावधी: सुरक्षित संरक्षण मापदंड सक्रियपणे राखले गेले आहेत.",
      "संरक्षण सील: ताजेपणा टिकवण्यासाठी अन्न घेईपर्यंत दरवाजा सीलबंद ठेवा.",
      "सतत देखरेख: अन्न सुरक्षा ट्रॅकिंगसाठी थेट सेन्सर टेलिमेट्री नोंदवली जात आहे."
    ];
  }

  if (score === "spoilt") {
    return [
      "Immediate action: Notify facilities and sanitation teams for safe removal.",
      "Sustainable diversion: Direct expired items to organic composting or bio-waste recovery.",
      "Access restricted: Solenoid locked to prevent distribution; admin override required."
    ];
  }

  if (score === "aging") {
    return [
      "Prioritize prompt pickup within the upcoming collection window.",
      "Promote rapid reuse through community meal sharing or supervised reheating above 75°C.",
      "Maintain unit climate: Monitor chamber humidity and VOC gas buildup before the next cycle."
    ];
  }

  return [
    "Optimal storage window: Safe preservation parameters actively maintained.",
    "Preservation seal: Keep door sealed until retrieval to maximize freshness.",
    "Continuous monitoring: Live sensor telemetry logged for food safety traceability."
  ];
}
