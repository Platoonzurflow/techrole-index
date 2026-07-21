import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp } from "lucide-react";
import type { Trend } from "@/lib/types";

export function TrendBadge({ trend, label }: { trend?: Trend; label?: string }) {
  const Icon = trend?.direction === "up" ? ArrowUpRight : trend?.direction === "down" ? ArrowDownRight : trend?.direction === "neutral" ? ArrowRight : CircleHelp;
  return (
    <span className={`trend trend-${trend?.direction ?? "unknown"}`} title="Сравниваются средние соседних окон, порог ±3%">
      <Icon size={15} aria-hidden="true" />
      <span>{label ? `${label}: ` : ""}{trend?.change_percent == null ? "н/д" : `${trend.change_percent > 0 ? "+" : ""}${trend.change_percent}%`}</span>
    </span>
  );
}

