import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export function AppSelect({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="app-select-shell">
      <select {...props} className={`field app-select ${className}`.trim()}>
        {children}
      </select>
      <ChevronDown size={18} aria-hidden="true" />
    </span>
  );
}
