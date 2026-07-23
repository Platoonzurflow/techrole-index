import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export function Paywall({
  title = "Подробная аналитика доступна в Premium",
  description = "В Premium доступны графики примерно за 6 месяцев, полный рейтинг, сравнение профессий, расширенные фильтры и экспорт.",
  actionHref = "/pricing",
  actionLabel = "Посмотреть Premium",
  compact = false,
}: {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  compact?: boolean;
}) {
  return (
    <section className={`paywall ${compact ? "p-6" : "p-8 md:p-12"}`} aria-labelledby="paywall-title">
      <div className="relative max-w-2xl">
        <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-amber-400/15 text-amber-600"><LockKeyhole /></span>
        <h2 id="paywall-title" className="text-2xl font-semibold">{title}</h2>
        <p className="mt-3 text-muted">{description}</p>
        <Link href={actionHref} className="button-primary mt-6">{actionLabel}</Link>
      </div>
    </section>
  );
}
