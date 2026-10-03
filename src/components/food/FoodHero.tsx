/**
 * @deprecated
 * PRESERVED FOR FUTURE USE / REFERENCE
 * Superseded by FoodHeroV2.tsx (canonical animated chamber hero display).
 * DO NOT DELETE — Can be reactivated if requested.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../store/useTranslation";
import type { DonationRecord } from "../../types/domain";

const heroPalette = [
  ["#f6d7aa", "#dfaa74", "#8bb175"],
  ["#d7e6c2", "#8db56f", "#577f45"],
  ["#f1c5a0", "#c47b55", "#6c3f2e"],
  ["#e8d8bf", "#b89f7d", "#6f5b44"]
];

function pickPalette(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return heroPalette[total % heroPalette.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function visualType(name: string) {
  const normalized = name.toLowerCase();
  if (/(coffee|tea|latte|shake|juice|smoothie|milk)/.test(normalized)) return "cup";
  if (/(apple|orange|banana|fruit|produce|mango|guava)/.test(normalized)) return "fruit";
  if (/(wrap|roll|bread|baked|croissant|bun|sandwich)/.test(normalized)) return "bento";
  return "bowl";
}

export function FoodHero({ donation, items }: { donation?: DonationRecord; items?: DonationRecord[] }) {
  const { t } = useTranslation();
  const heroItems = useMemo(() => {
    const list = items?.length ? items : donation ? [donation] : [];
    return list.length ? list : undefined;
  }, [donation, items]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [heroItems?.[0]?.id]);

  const activeItem = heroItems?.[activeIndex] ?? donation;
  const previews = heroItems?.filter((_, index) => index !== activeIndex).slice(0, 2) ?? [];
  const palette = pickPalette(activeItem?.foodName ?? "EcoLocker");
  const heroShape = visualType(activeItem?.foodName ?? "EcoLocker");
  const badgeItems = [
    activeItem?.categoryLabel ?? t("ready"),
    activeItem?.dietTag?.replace("_", " ") ?? t("communityReady")
  ];

  function cycle(direction: -1 | 1) {
    if (!heroItems?.length) return;
    setActiveIndex((current) => (current + direction + heroItems.length) % heroItems.length);
  }

  return (
    <div
      className="food-hero food-hero-carousel"
      style={{ ["--hero-a" as string]: palette[0], ["--hero-b" as string]: palette[1], ["--hero-c" as string]: palette[2] }}
      onWheel={(event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          cycle(event.deltaX > 0 ? 1 : -1);
        } else {
          cycle(event.deltaY > 0 ? 1 : -1);
        }
      }}
    >
      <div className="food-hero-header">
        <div>
          <span className="food-hero-kicker">{activeItem?.categoryLabel ?? t("publicFoodProfile")}</span>
          <strong>{activeItem?.foodName ?? t("waitingMeal")}</strong>
        </div>
        {heroItems && heroItems.length > 1 ? <span className="food-hero-count">{activeIndex + 1}/{heroItems.length}</span> : null}
      </div>
      <div className="food-orbit food-orbit-showcase">
        <div className="food-hero-window">
          <div className="food-hero-arch" />
          <div className="food-hero-spotlight" />
          <div className={`food-generated food-generated-showcase ${heroShape}`}>
            <span className="food-generated-shadow" />
            <span className="food-generated-core" />
            <span className="food-generated-accent food-generated-accent-a" />
            <span className="food-generated-accent food-generated-accent-b" />
            <span className="food-generated-detail food-generated-detail-a" />
            <span className="food-generated-detail food-generated-detail-b" />
            <span className="food-initials">{initials(activeItem?.foodName ?? "Eco Meal")}</span>
          </div>
          <div className="food-hero-caption">
            <strong>{activeItem?.foodName ?? t("waitingMeal")}</strong>
            <span>{activeItem?.categoryLabel ?? t("noActiveDonation")}</span>
          </div>
        </div>
        <div className="food-side-rail">
          {previews.map((item) => (
            <button key={item.id} type="button" className="food-preview-card" onClick={() => setActiveIndex(heroItems!.findIndex((entry) => entry.id === item.id))}>
              <span className={`food-preview-visual is-${visualType(item.foodName)}`} />
              <strong>{item.foodName}</strong>
            </button>
          ))}
        </div>
        {badgeItems.map((item, index) => (
          <div key={item} className={`food-disc food-disc-small food-disc-small-${index + 1}`}>
            <span>{item}</span>
          </div>
        ))}
        {heroItems && heroItems.length > 1 ? (
          <div className="food-carousel-controls">
            <button type="button" className="food-carousel-button" onClick={() => cycle(-1)} aria-label="Previous item">
              ◀
            </button>
            <button type="button" className="food-carousel-button" onClick={() => cycle(1)} aria-label="Next item">
              ▶
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
