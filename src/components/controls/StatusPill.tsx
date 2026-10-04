import { titleCase } from "../../utils/format";
import { useTranslation } from "../../store/useTranslation";

export function StatusPill({ value, tone = "default" }: { value: string | number; tone?: "default" | "warning" | "danger" | "success" | "spoiled" }) {
  const { t } = useTranslation();
  const displayValue = typeof value === "number" ? `${value}%` : (t(String(value).toLowerCase()) || titleCase(String(value)));
  return (
    <span className={`status-pill ${tone}`}>
      <span className="status-dot"></span>
      {displayValue}
    </span>
  );
}