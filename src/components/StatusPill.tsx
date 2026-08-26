import { titleCase } from "../utils/format";

export function StatusPill({ value, tone = "default" }: { value: string | number; tone?: "default" | "warning" | "danger" | "success" | "spoiled" }) {
  const displayValue = typeof value === "number" ? `${value}%` : value;
  return (
    <span className={`status-pill ${tone}`}>
      <span className="status-dot"></span>
      {titleCase(displayValue)}
    </span>
  );
}