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
  PlaneTakeoff 
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

export function getDonorTourSteps(t: (key: string, fallback?: string) => string): TourStep[] {
  return [
    {
      id: "donor-mode-select",
      targetSelector: ".donor-card-premium",
      route: "/",
      title: t("donorTourStep1Title", "1. Select Donor Mode"),
      description: t("donorTourStep1Desc", "Start here to donate fresh surplus meals. Sliding this card arms the kiosk and pre-selects an available, sanitized compartment ready for drop-off."),
      icon: HeartHandshake,
      position: "bottom",
      actionHint: t("donorTourStep1Hint", "Arms an available locker")
    },
    {
      id: "donor-telemetry",
      targetSelector: "[data-tour='donor-telemetry']",
      route: "/donate",
      title: t("donorTourStep2Title", "2. Climate & Locker Readiness"),
      description: t("donorTourStep2Desc", "Each locker is strictly climate-monitored. Check real-time chamber temperature, relative humidity, and sensor diagnostics before depositing."),
      icon: Thermometer,
      position: "right",
      actionHint: t("donorTourStep2Hint", "Live BME688 & DS18B20 telemetry")
    },
    {
      id: "donor-safety",
      targetSelector: "[data-tour='safety-button']",
      route: "/donate",
      title: t("donorTourStep3Title", "3. Food Safety & Capacity Rules"),
      description: t("donorTourStep3Desc", "Food safety is our top priority. Review guidelines anytime: proper airtight packaging, accepted food categories (raw, cooked, dairy, bakery), and prohibited items."),
      icon: ShieldCheck,
      position: "right",
      actionHint: t("donorTourStep3Hint", "FDA FSMA & FSSAI Schedule 4 hygiene")
    },
    {
      id: "donor-form",
      targetSelector: "[data-tour='start-donation-btn']",
      route: "/donate",
      title: t("donorTourStep4Title", "4. Begin Deposit & Registration"),
      description: t("donorTourStep4Desc", "Tap 'Start Donation' to launch the 4-step deposit wizard: food categorization, dietary labeling (Veg/Non-Veg), and confidential donor OTP or QR passkey verification."),
      icon: FileText,
      position: "top",
      actionHint: t("donorTourStep4Hint", "Launches 4-step registration wizard")
    },
    {
      id: "donor-deposit",
      targetSelector: "[data-tour='door-preview']",
      route: "/donate",
      title: t("donorTourStep5Title", "5. Auto-Deposit & Ultrasonic Verification"),
      description: t("donorTourStep5Desc", "Once submitted, the smart solenoid door unlocks automatically. Place the meal inside and push shut. Ultrasonic sensors detect presence and confirm an airtight seal."),
      icon: Box,
      position: "bottom",
      actionHint: t("donorTourStep5Hint", "Ultrasonic presence detection")
    },
    {
      id: "donor-tour-trigger",
      targetSelector: "[data-tour='nav-tour-trigger'], .action-pill-tour",
      route: "/donate",
      title: t("donorTourStep6Title", "6. Interactive Tour Button"),
      description: t("donorTourStep6Desc", "Need a refresher? Tap the Tour button anytime to replay this step-by-step interactive walkthrough across the entire platform."),
      icon: PlaneTakeoff,
      position: "bottom",
      actionHint: t("donorTourStep6Hint", "Relaunch Guided Tour Anytime")
    },
    {
      id: "universal-language",
      targetSelector: "[data-tour='universal-language'], .action-pill-en, [data-tour='nav-capsule-bar'], .action-list-luxe",
      route: "/donate",
      title: t("donorTourStep7Title", "7. Multilingual Access & Theme"),
      description: t("donorTourStep7Desc", "Switch the entire application instantly between English, Hindi (हिंदी), and Marathi (मराठी) with a single tap at any time, or toggle dark and light ambient modes."),
      icon: Globe,
      position: "bottom",
      actionHint: t("donorTourStep7Hint", "EN • HI • MR & Day/Night Toggle")
    },
    {
      id: "universal-voice",
      targetSelector: "[data-tour='universal-voice'], .voice-assistant-trigger",
      route: "/donate",
      title: t("donorTourStep8Title", "8. Hands-Free Voice Assistant"),
      description: t("donorTourStep8Desc", "Need hands-free operation? Tap the microphone button or speak voice commands anytime to query compartment contents or check system status."),
      icon: Mic,
      position: "left",
      actionHint: t("donorTourStep8Hint", "Voice commands & queries")
    },
    {
      id: "universal-help",
      targetSelector: "[data-tour='universal-help'], .help-widget-trigger",
      route: "/donate",
      title: t("donorTourStep9Title", "9. Help & Regulatory Standards"),
      description: t("donorTourStep9Desc", "Tap the Help icon anytime to view step-by-step visual workflow diagrams and inspect comprehensive FDA FSMA & FSSAI Schedule 4 regulations."),
      icon: HelpCircle,
      position: "right",
      actionHint: t("donorTourStep9Hint", "Standards & workflow diagrams")
    }
  ];
}

export function getReceiverTourSteps(t: (key: string, fallback?: string) => string): TourStep[] {
  return [
    {
      id: "receiver-mode-select",
      targetSelector: ".receiver-card-premium",
      route: "/",
      title: t("receiverTourStep1Title", "1. Select Receiver Mode"),
      description: t("receiverTourStep1Desc", "Looking for a fresh meal? Sliding this card opens the live Kiosk Dashboard showing verified, ready-to-consume food items available in the lockers."),
      icon: Utensils,
      position: "bottom",
      actionHint: t("receiverTourStep1Hint", "Opens public distribution dashboard")
    },
    {
      id: "receiver-chambers",
      targetSelector: "[data-tour='chamber-selection-header'], .selection-header",
      route: "/receive",
      title: t("receiverTourStep2Title", "2. Browse 8 Safe Compartments"),
      description: t("receiverTourStep2Desc", "Browse all 8 unit compartments. Visual badges show which units currently hold verified food and let you inspect each compartment's conditions."),
      icon: Grid,
      position: "right",
      actionHint: t("receiverTourStep2Hint", "8 independent smart units")
    },
    {
      id: "receiver-profile",
      targetSelector: ".hrd-food-name-row, .receiver-card-profile",
      route: "/receive",
      title: t("receiverTourStep3Title", "3. Food Details, Diet & Allergens"),
      description: t("receiverTourStep3Desc", "Inspect each item before retrieving: food title, vegetarian/non-vegetarian label, preparation timestamp, and allergen notes to guarantee it fits your dietary needs."),
      icon: Info,
      position: "right",
      actionHint: t("receiverTourStep3Hint", "Allergen & dietary transparency")
    },
    {
      id: "receiver-quality",
      targetSelector: ".hrd-qi-hero",
      route: "/receive",
      title: t("receiverTourStep4Title", "4. Quality Index & Spoilage Lock"),
      description: t("receiverTourStep4Desc", "Live BME688 gas and temperature sensors continuously evaluate freshness. The gauge displays shelf life. Food nearing spoilage is automatically locked for community safety."),
      icon: Activity,
      position: "right",
      actionHint: t("receiverTourStep4Hint", "Autonomous bacterial & spoilage guard")
    },
    {
      id: "receiver-retrieve",
      targetSelector: "[data-tour='receiver-slide-action'], .retrieve-action-area-luxe, .luxe-slide-container",
      route: "/receive",
      title: t("receiverTourStep5Title", "5. Biometric Retrieval & Fair Share"),
      description: t("receiverTourStep5Desc", "Slide to retrieve! A rapid biometric Face ID scan verifies pickup while enforcing our Fair Share Policy (2 meals/day) so everyone in the community receives access."),
      icon: ScanFace,
      position: "top",
      actionHint: t("receiverTourStep5Hint", "Biometric security & fair share limit")
    },
    {
      id: "receiver-tour-trigger",
      targetSelector: "[data-tour='nav-tour-trigger'], .action-pill-tour",
      route: "/receive",
      title: t("receiverTourStep6Title", "6. Interactive Tour Button"),
      description: t("receiverTourStep6Desc", "Need a refresher? Tap the Tour button anytime to replay this step-by-step interactive walkthrough across the entire platform."),
      icon: PlaneTakeoff,
      position: "bottom",
      actionHint: t("receiverTourStep6Hint", "Relaunch Guided Tour Anytime")
    },
    {
      id: "universal-language-recv",
      targetSelector: "[data-tour='universal-language'], .action-pill-en, [data-tour='nav-capsule-bar'], .action-list-luxe",
      route: "/receive",
      title: t("receiverTourStep7Title", "7. Multilingual Access & Theme"),
      description: t("receiverTourStep7Desc", "Switch the entire application instantly between English, Hindi (हिंदी), and Marathi (मराठी) with a single tap at any time, or toggle dark and light ambient modes."),
      icon: Globe,
      position: "bottom",
      actionHint: t("receiverTourStep7Hint", "EN • HI • MR & Day/Night Toggle")
    },
    {
      id: "universal-voice-recv",
      targetSelector: "[data-tour='universal-voice'], .voice-assistant-trigger",
      route: "/receive",
      title: t("receiverTourStep8Title", "8. Hands-Free Voice Assistant"),
      description: t("receiverTourStep8Desc", "Need hands-free operation? Tap the microphone button or speak voice commands anytime to query compartment contents or check system status."),
      icon: Mic,
      position: "left",
      actionHint: t("receiverTourStep8Hint", "Voice commands & queries")
    },
    {
      id: "universal-help-recv",
      targetSelector: "[data-tour='universal-help'], .help-widget-trigger",
      route: "/receive",
      title: t("receiverTourStep9Title", "9. Help & Regulatory Standards"),
      description: t("receiverTourStep9Desc", "Tap the Help icon anytime to view step-by-step visual workflow diagrams and inspect comprehensive FDA FSMA & FSSAI Schedule 4 regulations."),
      icon: HelpCircle,
      position: "right",
      actionHint: t("receiverTourStep9Hint", "Standards & workflow diagrams")
    }
  ];
}

export function getDonorCompletion(t: (key: string, fallback?: string) => string): TourCompletionData {
  return {
    title: t("donorCompletionTitle", "You're Ready to Share the Joy!"),
    subtitle: t("donorCompletionSubtitle", "Thank you for fighting food waste and supporting our community."),
    quote: t("donorCompletionQuote", "“Every meal shared brings dignity, nourishment, and a healthier planet.”"),
    badge: t("donorCompletionBadge", "DONOR READY"),
    buttonLabel: t("donorCompletionBtn", "Return to Main Menu & Start Donating"),
    celebrationEmoji: "🎁"
  };
}

export function getReceiverCompletion(t: (key: string, fallback?: string) => string): TourCompletionData {
  return {
    title: t("receiverCompletionTitle", "You're All Set! Enjoy Your Fresh Meal!"),
    subtitle: t("receiverCompletionSubtitle", "Healthy, verified food is prepared and safely stored for you."),
    quote: t("receiverCompletionQuote", "“Good food belongs to everyone. Enjoy your meal with complete peace of mind!”"),
    badge: t("receiverCompletionBadge", "RECEIVER READY"),
    buttonLabel: t("receiverCompletionBtn", "Return to Main Menu & Explore Food"),
    celebrationEmoji: "🍴"
  };
}

export const DONOR_TOUR_STEPS: TourStep[] = getDonorTourSteps((_, fb) => fb || "");
export const RECEIVER_TOUR_STEPS: TourStep[] = getReceiverTourSteps((_, fb) => fb || "");
export const DONOR_COMPLETION: TourCompletionData = getDonorCompletion((_, fb) => fb || "");
export const RECEIVER_COMPLETION: TourCompletionData = getReceiverCompletion((_, fb) => fb || "");
