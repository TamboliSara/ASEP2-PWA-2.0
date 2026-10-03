import type { LucideIcon } from "lucide-react";
import { 
  HeartHandshake, 
  Thermometer, 
  ShieldCheck, 
  FileText, 
  Box, 
  Globe, 
  Mic, 
  HelpCircle,
  Utensils,
  Grid,
  Info,
  Activity,
  ScanFace,
  Cpu,
  PlaneTakeoff,
  Bluetooth
} from "lucide-react";

export type TourPath = "donor" | "receiver";

export interface TourStep {
  id: string;
  targetSelector: string;
  route: string;
  title: string;
  description: string;
  icon: LucideIcon;
  position?: "top" | "bottom" | "left" | "right" | "auto";
  actionHint?: string;
}

export interface TourCompletionData {
  title: string;
  subtitle: string;
  quote: string;
  badge: string;
  buttonLabel: string;
  celebrationEmoji: string;
}

export const DONOR_TOUR_STEPS: TourStep[] = [
  {
    id: "donor-mode-select",
    targetSelector: ".donor-card-premium",
    route: "/",
    title: "1. Select Donor Mode",
    description: "Start here to donate fresh surplus meals. Sliding this card arms the kiosk and pre-selects an available, sanitized compartment ready for drop-off.",
    icon: HeartHandshake,
    position: "top",
    actionHint: "Arms an available locker"
  },
  {
    id: "donor-telemetry",
    targetSelector: "[data-tour='donor-telemetry']",
    route: "/donate",
    title: "2. Climate & Locker Readiness",
    description: "Each locker is strictly climate-monitored. Check real-time chamber temperature, relative humidity, and sensor diagnostics before depositing.",
    icon: Thermometer,
    position: "right",
    actionHint: "Live BME688 & DS18B20 telemetry"
  },
  {
    id: "donor-safety",
    targetSelector: "[data-tour='safety-button']",
    route: "/donate",
    title: "3. Food Safety & Capacity Rules",
    description: "Food safety is our top priority. Review guidelines anytime: proper airtight packaging, accepted food categories (raw, cooked, dairy, bakery), and prohibited items.",
    icon: ShieldCheck,
    position: "right",
    actionHint: "FDA FSMA & FSSAI Schedule 4 hygiene"
  },
  {
    id: "donor-form",
    targetSelector: "[data-tour='start-donation-btn']",
    route: "/donate",
    title: "4. Begin Deposit & Registration",
    description: "Tap 'Start Donation' to launch the 4-step deposit wizard: food categorization, dietary labeling (Veg/Non-Veg), and confidential donor OTP or QR passkey verification.",
    icon: FileText,
    position: "top",
    actionHint: "Launches 4-step registration wizard"
  },
  {
    id: "donor-deposit",
    targetSelector: "[data-tour='door-preview']",
    route: "/donate",
    title: "5. Auto-Deposit & Ultrasonic Verification",
    description: "Once submitted, the smart solenoid door unlocks automatically. Place the meal inside and push shut. Ultrasonic sensors detect presence and confirm an airtight seal.",
    icon: Box,
    position: "bottom",
    actionHint: "Ultrasonic presence detection"
  },
  {
    id: "donor-esp32-status",
    targetSelector: "[data-tour='nav-esp32'], .action-pill-esp32",
    route: "/donate",
    title: "6. ESP32 (3D4C) Hardware Telemetry",
    description: "Monitors the live IoT hardware connection with Chamber 1's ESP32-S3 microcontroller. Real-time BLE heartbeat, WiFi synchronization, and solenoid lock state are streamed continuously.",
    icon: Bluetooth,
    position: "bottom",
    actionHint: "Live ESP32 (3D4C) Microcontroller"
  },
  {
    id: "donor-tour-trigger",
    targetSelector: "[data-tour='nav-tour-trigger'], .action-pill-tour",
    route: "/donate",
    title: "7. Interactive Tour Button",
    description: "Need a refresher? Tap the Tour button anytime to replay this step-by-step interactive walkthrough across the entire platform.",
    icon: PlaneTakeoff,
    position: "bottom",
    actionHint: "Relaunch Guided Tour Anytime"
  },
  {
    id: "donor-3d-model",
    targetSelector: "[data-tour='nav-3d-model'], .action-pill-visualizer",
    route: "/donate",
    title: "8. 3D CAD Model Visualizer",
    description: "Directly beside the tour button, tap this 3D icon to open the interactive digital twin. Inspect exploded 3D CAD models of the food chamber, sensors, and chassis.",
    icon: Box,
    position: "bottom",
    actionHint: "Interactive 3D Digital Twin"
  },
  {
    id: "universal-language",
    targetSelector: "[data-tour='universal-language'], .action-pill-en, [data-tour='nav-capsule-bar'], .action-list-luxe",
    route: "/donate",
    title: "9. Multilingual Access & Theme",
    description: "Switch the entire application instantly between English, Hindi (हिंदी), and Marathi (मराठी) with a single tap at any time, or toggle dark and light ambient modes.",
    icon: Globe,
    position: "bottom",
    actionHint: "EN • HI • MR & Day/Night Toggle"
  },
  {
    id: "universal-voice",
    targetSelector: "[data-tour='universal-voice'], .voice-assistant-trigger",
    route: "/donate",
    title: "10. Hands-Free Voice Assistant",
    description: "Need hands-free operation? Tap the microphone button or speak voice commands anytime to query compartment contents or check system status.",
    icon: Mic,
    position: "left",
    actionHint: "Voice commands & queries"
  },
  {
    id: "universal-help",
    targetSelector: "[data-tour='universal-help'], .help-widget-trigger",
    route: "/donate",
    title: "11. Help & Regulatory Standards",
    description: "Tap the Help icon anytime to view step-by-step visual workflow diagrams and inspect comprehensive FDA FSMA & FSSAI Schedule 4 regulations.",
    icon: HelpCircle,
    position: "right",
    actionHint: "Standards & workflow diagrams"
  }
];

export const RECEIVER_TOUR_STEPS: TourStep[] = [
  {
    id: "receiver-mode-select",
    targetSelector: ".receiver-card-premium",
    route: "/",
    title: "1. Select Receiver Mode",
    description: "Looking for a fresh meal? Sliding this card opens the live Kiosk Dashboard showing verified, ready-to-consume food items available in the lockers.",
    icon: Utensils,
    position: "top",
    actionHint: "Opens public distribution dashboard"
  },
  {
    id: "receiver-chambers",
    targetSelector: "[data-tour='chamber-selection-header'], .selection-header",
    route: "/receive",
    title: "2. Browse 8 Safe Compartments",
    description: "Browse all 8 unit compartments. Visual badges show which units currently hold verified food and let you inspect each compartment's conditions.",
    icon: Grid,
    position: "right",
    actionHint: "8 independent smart units"
  },
  {
    id: "receiver-profile",
    targetSelector: ".hrd-food-name-row, .receiver-card-profile",
    route: "/receive",
    title: "3. Food Details, Diet & Allergens",
    description: "Inspect each item before retrieving: food title, vegetarian/non-vegetarian label, preparation timestamp, and allergen notes to guarantee it fits your dietary needs.",
    icon: Info,
    position: "right",
    actionHint: "Allergen & dietary transparency"
  },
  {
    id: "receiver-quality",
    targetSelector: ".hrd-qi-hero",
    route: "/receive",
    title: "4. Quality Index & Spoilage Lock",
    description: "Live BME688 gas and temperature sensors continuously evaluate freshness. The gauge displays shelf life. Food nearing spoilage is automatically locked for community safety.",
    icon: Activity,
    position: "right",
    actionHint: "Autonomous bacterial & spoilage guard"
  },
  {
    id: "receiver-retrieve",
    targetSelector: "[data-tour='receiver-slide-action'], .retrieve-action-area-luxe, .luxe-slide-container",
    route: "/receive",
    title: "5. Biometric Retrieval & Fair Share",
    description: "Slide to retrieve! A rapid biometric Face ID scan verifies pickup while enforcing our Fair Share Policy (2 meals/day) so everyone in the community receives access.",
    icon: ScanFace,
    position: "top",
    actionHint: "Biometric security & fair share limit"
  },
  {
    id: "receiver-esp32-status",
    targetSelector: "[data-tour='nav-esp32'], .action-pill-esp32",
    route: "/receive",
    title: "6. ESP32 (3D4C) Hardware Telemetry",
    description: "Monitors the live IoT hardware connection with Chamber 1's ESP32-S3 microcontroller. Real-time BLE heartbeat, WiFi synchronization, and solenoid lock state are streamed continuously.",
    icon: Bluetooth,
    position: "bottom",
    actionHint: "Live ESP32 (3D4C) Microcontroller"
  },
  {
    id: "receiver-tour-trigger",
    targetSelector: "[data-tour='nav-tour-trigger'], .action-pill-tour",
    route: "/receive",
    title: "7. Interactive Tour Button",
    description: "Need a refresher? Tap the Tour button anytime to replay this step-by-step interactive walkthrough across the entire platform.",
    icon: PlaneTakeoff,
    position: "bottom",
    actionHint: "Relaunch Guided Tour Anytime"
  },
  {
    id: "receiver-3d-model",
    targetSelector: "[data-tour='nav-3d-model'], .action-pill-visualizer",
    route: "/receive",
    title: "8. 3D CAD Model Visualizer",
    description: "Directly beside the tour button, tap this 3D icon to open the interactive digital twin. Inspect exploded 3D CAD models of the food chamber, sensors, and chassis.",
    icon: Box,
    position: "bottom",
    actionHint: "Interactive 3D Digital Twin"
  },
  {
    id: "universal-language-recv",
    targetSelector: "[data-tour='universal-language'], .action-pill-en, [data-tour='nav-capsule-bar'], .action-list-luxe",
    route: "/receive",
    title: "9. Multilingual Access & Theme",
    description: "Switch the entire application instantly between English, Hindi (हिंदी), and Marathi (मराठी) with a single tap at any time, or toggle dark and light ambient modes.",
    icon: Globe,
    position: "bottom",
    actionHint: "EN • HI • MR & Day/Night Toggle"
  },
  {
    id: "universal-voice-recv",
    targetSelector: "[data-tour='universal-voice'], .voice-assistant-trigger",
    route: "/receive",
    title: "10. Hands-Free Voice Assistant",
    description: "Need hands-free operation? Tap the microphone button or speak voice commands anytime to query compartment contents or check system status.",
    icon: Mic,
    position: "left",
    actionHint: "Voice commands & queries"
  },
  {
    id: "universal-help-recv",
    targetSelector: "[data-tour='universal-help'], .help-widget-trigger",
    route: "/receive",
    title: "11. Help & Regulatory Standards",
    description: "Tap the Help icon anytime to view step-by-step visual workflow diagrams and inspect comprehensive FDA FSMA & FSSAI Schedule 4 regulations.",
    icon: HelpCircle,
    position: "right",
    actionHint: "Standards & workflow diagrams"
  }
];

export const DONOR_COMPLETION: TourCompletionData = {
  title: "You're Ready to Share the Joy!",
  subtitle: "Thank you for fighting food waste and supporting our community.",
  quote: "“Every meal shared brings dignity, nourishment, and a healthier planet.”",
  badge: "DONOR READY",
  buttonLabel: "Return to Main Menu & Start Donating",
  celebrationEmoji: "🎁"
};

export const RECEIVER_COMPLETION: TourCompletionData = {
  title: "You're All Set! Enjoy Your Fresh Meal!",
  subtitle: "Healthy, verified food is prepared and safely stored for you.",
  quote: "“Good food belongs to everyone. Enjoy your meal with complete peace of mind!”",
  badge: "RECEIVER READY",
  buttonLabel: "Return to Main Menu & Explore Food",
  celebrationEmoji: "🍴"
};
