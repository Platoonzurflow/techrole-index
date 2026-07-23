import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import type { ProfessionSummary } from "@/lib/types";

const confidenceLabels: Record<string, string> = {
  high: "Крупная выборка",
  medium: "Расширенная выборка",
  low: "Базовая выборка",
  insufficient: "Данные собираются",
};

export function ProfessionCard({ profession }: { profession: ProfessionSummary }) {
  const scoreStyle = { "--score": `${profession.score ?? 0}%` } as CSSProperties;

  return (
    <article className="profession-card group flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-extrabold leading-tight tracking-tight">
        <Link href={`/professions/${profession.slug}`} className="after:absolute after:inset-0 after:z-10 transition-colors group-hover:text-accent">{profession.name_ru}</Link>
        </h2>
        {profession.score != null ? (
          <div className="flex items-center gap-3">
            <div className="score-disc" style={scoreStyle}><strong className="font-mono text-sm">{profession.score}</strong></div>
            <div className="hidden sm:block"><span className="text-xs font-semibold uppercase tracking-wider text-muted">Индекс</span><p className="text-sm font-bold">из 100</p></div>
          </div>
        ) : <span className="font-mono text-2xl font-bold text-muted">-</span>}
      </div>
      <div className="mt-2 flex items-center gap-2"><span className={`category-mark category-${profession.category_slug}`} aria-hidden="true" /><span className="text-xs font-extrabold uppercase tracking-[.12em] text-muted">{profession.category_name}</span></div>
      <p className="mt-1 text-sm text-muted">{profession.name_en}</p>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted">{profession.description}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5 text-xs font-semibold text-muted"><span className="vacancy-chip">Junior · Middle · Senior</span><span className="vacancy-chip">Стек роли</span></div>
      <div className="relative flex items-center justify-between pt-5"><div>{profession.teaser_only ? <span className="badge badge-premium"><LockKeyhole size={12} /> Premium</span> : profession.data_confidence ? <span className={`badge confidence-${profession.data_confidence}`}>{confidenceLabels[profession.data_confidence] ?? profession.data_confidence}</span> : null}</div><span className="card-arrow"><ArrowRight size={17} aria-hidden="true" /></span></div>
    </article>
  );
}
