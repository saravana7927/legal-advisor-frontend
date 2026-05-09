import type { RiskLevel } from "@/lib/api";

export type RiskBadgeLevel = RiskLevel | "neutral";

const styles: Record<RiskBadgeLevel, string> = {
  high: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  medium: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  low: "bg-green-50 text-green-800 ring-1 ring-inset ring-green-200",
  neutral: "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200",
};

function normalizeRisk(r: string): RiskBadgeLevel {
  const v = r.toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "neutral";
}

export interface RiskBadgeProps {
  risk: RiskBadgeLevel | string;
  label?: string;
  className?: string;
}

export function RiskBadge({ risk, label, className = "" }: RiskBadgeProps) {
  const key = normalizeRisk(risk);
  const text = label ?? risk.toString().toUpperCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[key]} ${className}`}
    >
      {text}
    </span>
  );
}
