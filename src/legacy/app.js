// ==========================================================================
// 1. SERVICE WORKER REGISTRATION (PWA Setup)
// ==========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('PWA ServiceWorker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
}

// ==========================================================================
// 2. LOCALIZATION ENGINE (Instant Language Swap)
// ==========================================================================
const translations = {
    en: {
        brand: "EcoLocker",
        headline: "Share Food.<br>Fight Hunger.",
        subhead: "A sustainable, climate-controlled community exchange.",
        deposit: "Deposit Food",
        depositDesc: "Securely share a meal.",
        retrieve: "Retrieve Food",
        retrieveDesc: "Take what you need.",
        temp: "Internal Temp",
        airQuality: "Air Quality (VOC)",
        status: "Locker Status"
    },
    hi: {
        brand: "इको-लॉकर",
        headline: "खाना साझा करें.<br>भूख मिटाएं.",
        subhead: "एक टिकाऊ और सुरक्षित सामुदायिक पहल।",
        deposit: "खाना जमा करें",
        depositDesc: "सुरक्षित रूप से भोजन साझा करें।",
        retrieve: "खाना प्राप्त करें",
        retrieveDesc: "अपनी जरूरत का लें।",
        temp: "आंतरिक तापमान",
        airQuality: "वायु गुणवत्ता (VOC)",
        status: "लॉकर की स्थिति"
    },
    mr: {
        brand: "इको-लॉकर",
        headline: "अन्न वाटप करा.<br>भूक थांबवा.",
        subhead: "एक सुरक्षित आणि शाश्वत सामुदायिक उपक्रम.",
        deposit: "अन्न जमा करा",
        depositDesc: "सुरक्षितपणे अन्न सामायिक करा.",
        retrieve: "अन्न घ्या",
        retrieveDesc: "आपल्या गरजेनुसार घ्या.",
        temp: "अंतर्गत तापमान",
        airQuality: "हवेची गुणवत्ता (VOC)",
        status: "लॉकरची स्थिती"
    }
};

function setLanguage(langCode) {
    // Update active button styling
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText.toLowerCase() === langCode || 
           (langCode === 'hi' && btn.innerText === 'हिंदी') ||
           (langCode === 'mr' && btn.innerText === 'मराठी')) {
            btn.classList.add('active');
        }
    });

    // Instantly swap all text on screen
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = translations[langCode][key];
    });
}

// ==========================================================================
// 3. THEME ENGINE (Light/Dark & Colors)
// ==========================================================================
function toggleLightMode() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    body.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
}

function setColor(colorName) {
    document.body.setAttribute('data-color', colorName);
}

// ==========================================================================
// 4. VIEW NAVIGATION (Screen Swapping)
// ==========================================================================
function showView(viewId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    // Show requested view smoothly
    const activeView = document.getElementById(viewId);
    activeView.classList.remove('hidden');
    
    // Tiny delay to allow CSS transition to play smoothly
    setTimeout(() => {
        activeView.classList.add('active');
    }, 50);
}

function goHome() {
    showView('view-home');
}

// ==========================================================================
// 5. HARDWARE / APP LOGIC FLOW
// ==========================================================================
function startDepositFlow() {
    console.log("Deposit initiated. Moving to Category Selection.");
    showView('view-deposit');
}

function selectCategory(categoryId) {
    console.log("Selected Food Category ID:", categoryId);
    
    // Next steps we will build:
    // 1. Ask for Allergens / Veg status
    // 2. Open Bluetooth connection to ESP32
    // 3. Send Category ID to ESP32 Core 0 (AI Classifier)
    
    alert("Category " + categoryId + " selected! (Next: Allergen form & ESP32 Bluetooth Sync)");
}

function startRetrieveFlow() {
    console.log("Retrieve Flow Initiated");
    
    // Next steps we will build:
    // 1. Check BME688 Spoilage Status
    // 2. Trigger Web Bluetooth API to unlock solenoid
    // 3. Start UV-C / Fan sterilization cycle
    
    alert("Checking BME688 Spoilage status... (Bluetooth logic coming next)");
}