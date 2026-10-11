/**
 * format.ts
 * Formatting and localization utilities for SAFE Locker PWA.
 */
const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/**
 * Converts Western digits (0-9) to Devanagari numerals (०-९) when in Hindi ('hi') or Marathi ('mr') mode.
 */
export function toLocalDigits(val: string | number | undefined | null, locale: string = "en"): string {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (locale === "hi" || locale === "mr") {
    return str.replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[parseInt(d, 10)]);
  }
  return str;
}

/**
 * Translates predefined food names to the selected language.
 */
export function translateFoodName(foodName: string | undefined | null, locale: string = "en"): string {
  if (!foodName) return "";
  const lower = foodName.toLowerCase().trim();

  if (locale === "hi") {
    if (lower.includes("mixed fruit") || lower.includes("fruit bowl") || lower.includes("fruits")) return "मिश्रित फल का कटोरा";
    if (lower.includes("chicken biryani")) return "चिकन बिरयानी";
    if (lower.includes("veg biryani") || lower.includes("biryani")) return "दम बिरयानी";
    if (lower === "bread" || lower.includes("artisan loaf") || lower.includes("artisan bread") || lower.includes("bread")) return "ताज़ा ब्रेड";
    if (lower.includes("vegetable pulao") || lower.includes("veg pulao") || lower.includes("pulao")) return "सब्ज़ी पुलाव";
    if (lower.includes("vegetable pasta") || lower.includes("pasta")) return "वेजिटेबल पास्ता";
    if (lower.includes("apple pie")) return "एप्पल पाई";
    if (lower.includes("paneer")) return "पनीर टिक्का / करी";
    if (lower.includes("dal") || lower.includes("daal")) return "दाल तड़का";
    if (lower.includes("roti") || lower.includes("chapati")) return "ताज़ा रोटियां";
    if (lower.includes("rice")) return "चावल / भात";
    if (lower.includes("sandwich")) return "वेजिटेबल सैंडविच";
    if (lower.includes("salad")) return "हरा सलाद";
    if (lower.includes("samosa")) return "समोसा";
    if (lower.includes("curry")) return "सब्ज़ी करी";
    if (lower.includes("soup")) return "वेजिटेबल सूप";
    if (lower.includes("idli") || lower.includes("dosa")) return "इडली सांबर";
    if (lower.includes("donated food") || lower.includes("food item") || lower.includes("food")) return "दान किया गया भोजन";
  }

  if (locale === "mr") {
    if (lower.includes("mixed fruit") || lower.includes("fruit bowl") || lower.includes("fruits")) return "मिश्र फळांची वाटी";
    if (lower.includes("chicken biryani")) return "चिकन बिर्याणी";
    if (lower.includes("veg biryani") || lower.includes("biryani")) return "दम बिर्याणी";
    if (lower === "bread" || lower.includes("artisan loaf") || lower.includes("artisan bread") || lower.includes("bread")) return "ताजी ब्रेड";
    if (lower.includes("vegetable pulao") || lower.includes("veg pulao") || lower.includes("pulao")) return "व्हेज पुलाव";
    if (lower.includes("vegetable pasta") || lower.includes("pasta")) return "व्हेज पास्ता";
    if (lower.includes("apple pie")) return "सफरचंद पाय";
    if (lower.includes("paneer")) return "पनीर टिक्का / भाजी";
    if (lower.includes("dal") || lower.includes("daal")) return "डाळ तडका";
    if (lower.includes("roti") || lower.includes("chapati") || lower.includes("bhakri")) return "गरमागरम पोळ्या / भाकरी";
    if (lower.includes("rice")) return "भात / पुलाव";
    if (lower.includes("sandwich")) return "व्हेज सँडविच";
    if (lower.includes("salad")) return "ताजी कोशिंबीर";
    if (lower.includes("samosa")) return "समोसा";
    if (lower.includes("curry")) return "भाजी / रस्सा";
    if (lower.includes("soup")) return "व्हेज सूप";
    if (lower.includes("idli") || lower.includes("dosa")) return "इडली सांबार";
    if (lower.includes("donated food") || lower.includes("food item") || lower.includes("food")) return "दान केलेले अन्न";
  }

  return foodName.charAt(0).toUpperCase() + foodName.slice(1);
}

/**
 * Translates food categories to the selected language.
 */
export function translateCategory(cat: string | undefined | null, locale: string = "en"): string {
  if (!cat) return "";
  const lower = cat.toLowerCase().trim();

  if (locale === "hi") {
    if (lower.includes("raw") || lower.includes("produce")) return "कच्ची सब्ज़ियां / फल";
    if (lower.includes("cooked") || lower.includes("meal")) return "पका हुआ भोजन";
    if (lower.includes("baked") || lower.includes("goods") || lower.includes("bread")) return "बेकरी उत्पाद";
    if (lower.includes("dairy") || lower.includes("liquid")) return "डेयरी / तरल";
  }

  if (locale === "mr") {
    if (lower.includes("raw") || lower.includes("produce")) return "कच्च्या भाज्या / फळे";
    if (lower.includes("cooked") || lower.includes("meal")) return "शिजवलेले अन्न";
    if (lower.includes("baked") || lower.includes("goods") || lower.includes("bread")) return "बेकरी उत्पादने";
    if (lower.includes("dairy") || lower.includes("liquid")) return "डेअरी / द्रव";
  }

  return cat;
}

/**
 * Translates donor names to the selected language script.
 */
export function translateDonorName(name: string | undefined | null, locale: string = "en"): string {
  if (!name) return "";
  const lower = name.toLowerCase().trim();

  if (locale === "hi" || locale === "mr") {
    if (lower.includes("amit")) return "अमित शर्मा";
    if (lower.includes("rahul")) return "राहुल देसाई";
    if (lower.includes("vikram")) return "विक्रम सिंह";
  }

  return name;
}

/**
 * Translates allergen and dietary notes to the selected language.
 */
export function translateAllergens(notes: string | undefined | null, locale: string = "en"): string {
  if (!notes) {
    if (locale === "hi") return "कोई एलर्जेन नहीं • सभी के लिए सुरक्षित";
    if (locale === "mr") return "कोणतेही एलर्जेन नाही • सर्वांसाठी सुरक्षित";
    return "No common allergens declared — Safe for all";
  }

  const lower = notes.toLowerCase().trim();
  if (lower === "none" || lower === "no allergens" || lower.includes("no common allergens")) {
    if (lower.includes("fruit")) {
      if (locale === "hi") return "कोई सामान्य एलर्जेन नहीं • ताजे मौसमी फल (सेब, संतरा, खरबूजा)";
      if (locale === "mr") return "कोणतेही सामान्य एलर्जेन नाही • ताजी हंगामी फळे (सफरचंद, संत्री, कलिंगड)";
    }
    if (locale === "hi") return "कोई सामान्य एलर्जेन नहीं";
    if (locale === "mr") return "कोणतेही सामान्य एलर्जेन नाही";
    return "No common allergens • Fresh seasonal fruits";
  }

  if (lower.includes("cashew") || lower.includes("ghee") || lower.includes("nuts")) {
    if (locale === "hi") return "मेवे (काजू) और डेयरी (घी) शामिल हैं • मसालेदार भोजन";
    if (locale === "mr") return "काजू आणि डेअरी (तूप) समाविष्ट आहे • मसालेदार जेवण";
  }

  if (lower.includes("gluten") || lower.includes("wheat") || lower.includes("bread")) {
    if (locale === "hi") return "ग्लूटेन और गेहूं शामिल हैं • ताजा बेक किया हुआ कारीगर ब्रेड";
    if (locale === "mr") return "ग्लूटेन आणि गहू समाविष्ट आहे • ताजी बेक केलेली ब्रेड";
  }

  return notes;
}

/**
 * Translates AI cognitive insight texts.
 */
export function translateInsight(insight: string | undefined | null, locale: string = "en"): string {
  if (!insight) return "";
  const lower = insight.toLowerCase();

  if (locale === "hi") {
    if (lower.includes("optimal") || lower.includes("stable")) {
      return "स्थिति उत्तम: अगले 8+ घंटों के लिए खाद्य गुणवत्ता स्थिर है।";
    }
    if (lower.includes("consume soon") || lower.includes("warning") || lower.includes("aging")) {
      return "चेतावनी: खाद्य गुणवत्ता मध्यम हो रही है, इसे शीघ्र उपभोग करने की सलाह दी जाती है।";
    }
    if (lower.includes("spoiled") || lower.includes("critical")) {
      return "गंभीर: सुरक्षा सीमा समाप्त, खाद्य पदार्थ अब उपभोग के लिए उपयुक्त नहीं है।";
    }
  }

  if (locale === "mr") {
    if (lower.includes("optimal") || lower.includes("stable")) {
      return "स्थिती उत्तम: पुढील 8+ तासांसाठी अन्नाची गुणवत्ता स्थिर आहे.";
    }
    if (lower.includes("consume soon") || lower.includes("warning") || lower.includes("aging")) {
      return "चेतावणी: अन्नाची गुणवत्ता मध्यम होत आहे, लवकर वापरण्याचा सल्ला दिला जातो.";
    }
    if (lower.includes("spoiled") || lower.includes("critical")) {
      return "गंभीर: सुरक्षा मर्यादा संपली, अन्न आता खाण्यासाठी योग्य नाही.";
    }
  }

  return insight;
}

export function formatDateTime(value?: string, locale: string = "en") {
  if (!value) {
    if (locale === "hi") return "सिंक नहीं हुआ";
    if (locale === "mr") return "सिंक झालेले नाही";
    return "Not synced yet";
  }

  const intlLocale = locale === "hi" ? "hi-IN" : locale === "mr" ? "mr-IN" : undefined;
  const formatted = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

  return toLocalDigits(formatted, locale);
}

export function formatRelativeHours(hours: number, locale: string = "en") {
  if (hours <= 0) {
    if (locale === "hi") return "समाप्त";
    if (locale === "mr") return "समाप्त";
    return "Expired";
  }

  const numStr = toLocalDigits(hours.toFixed(1), locale);
  if (locale === "hi") return `${numStr} घंटे शेष`;
  if (locale === "mr") return `${numStr} तास शिल्लक`;
  return `${hours.toFixed(1)} hours remaining`;
}

export function getHoursRemaining(targetIso?: string) {
  if (!targetIso) {
    return 0;
  }

  const remainingMs = new Date(targetIso).getTime() - Date.now();
  return Math.max(0, remainingMs / (1000 * 60 * 60));
}

export function formatCountdown(targetIso?: string, locale: string = "en") {
  if (!targetIso) {
    if (locale === "hi") return "उपलब्ध नहीं";
    if (locale === "mr") return "उपलब्ध नाही";
    return "Not available";
  }

  const remainingMs = new Date(targetIso).getTime() - Date.now();
  if (remainingMs <= 0) {
    if (locale === "hi") return "समाप्त";
    if (locale === "mr") return "समाप्त";
    return "Expired";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = toLocalDigits(String(hours).padStart(2, "0"), locale);
  const mm = toLocalDigits(String(minutes).padStart(2, "0"), locale);
  const ss = toLocalDigits(String(seconds).padStart(2, "0"), locale);

  if (locale === "hi") return `${hh}:${mm}:${ss} शेष`;
  if (locale === "mr") return `${hh}:${mm}:${ss} शिल्लक`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} remaining`;
}

export function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
