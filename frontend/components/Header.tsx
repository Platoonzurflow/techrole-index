import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PremiumHeaderStatus } from "@/components/PremiumHeaderStatus";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  ["Профессии", "/professions"],
  ["Рейтинг", "/top"],
  ["Сравнение", "/compare"],
  ["Методология", "/methodology"],
  ["Личное ведение", "/mentorship"],
];

export function Header() {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-white/10 bg-[#09090b]/95 text-white backdrop-blur-xl">
      <div className="h-[2px] bg-[linear-gradient(90deg,var(--accent),#ff5964,transparent_82%)]" />
      <div className="shell flex min-h-16 items-center gap-5">
        <Link href="/" className="brand group flex shrink-0 items-center gap-2.5 font-extrabold tracking-tight" aria-label="TechRole Index - главная">
          <span className="brand-mark grid size-10 place-items-center rounded-lg bg-accent text-white">
            <BarChart3 size={19} aria-hidden="true" />
          </span>
          <span>TechRole <span className="text-accent">Index</span></span>
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-1 xl:flex" aria-label="Основная навигация">
          {links.map(([label, href]) => <Link key={href} href={href} className="nav-link whitespace-nowrap">{label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <PremiumHeaderStatus />
          <span className="status-line mr-1 hidden 2xl:inline-flex"><span className="live-dot" /> Обновлено сегодня</span>
          <ThemeToggle />
          <Link href="/account" className="header-account hidden sm:inline-flex">Кабинет</Link>
        </div>
      </div>
      <nav className="scrollbar-none shell flex gap-1 overflow-x-auto pb-2 xl:hidden" aria-label="Мобильная навигация">
        {links.map(([label, href]) => <Link key={href} href={href} className="nav-link shrink-0 whitespace-nowrap text-sm">{label}</Link>)}
        <Link href="/account" className="nav-link shrink-0 whitespace-nowrap text-sm sm:hidden">Кабинет</Link>
      </nav>
    </header>
  );
}
