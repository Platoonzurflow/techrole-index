import Link from "next/link";
import { LifeBuoy } from "lucide-react";

export function SupportButton() {
  return (
    <Link
      href="/support"
      className="support-button group fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#111113] px-4 py-3 font-bold text-white shadow-[0_14px_40px_rgb(0_0_0/.3)] transition hover:-translate-y-1 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label="Открыть техподдержку"
      title="Техподдержка"
    >
      <LifeBuoy size={18} aria-hidden="true" />
      <span className="hidden sm:inline">Техподдержка</span>
    </Link>
  );
}
