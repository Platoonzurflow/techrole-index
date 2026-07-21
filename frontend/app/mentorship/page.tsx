import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Check, Compass, Dumbbell, MessagesSquare, Target } from "lucide-react";
import { MentorshipForm } from "@/components/MentorshipForm";

export const metadata: Metadata = {
  title: "Личное ведение до офера",
  description: "Персональная восьминедельная программа: выбор направления, карьерный план, тренировки и подготовка к собеседованиям.",
  alternates: { canonical: "/mentorship" },
};

const stages = [
  ["01", "Направление и план", "Оцениваем опыт, интересы и ограничения. Выбираем целевую роль и фиксируем персональный маршрут на восемь недель."],
  ["02", "Навыки и практика", "Закрываем ключевые пробелы точечной теорией, задачами и регулярной обратной связью по выбранному стеку."],
  ["03", "Проекты и позиционирование", "Доводим портфолио, резюме и самопрезентацию до состояния, с которым можно уверенно выходить на рынок."],
  ["04", "Отклики и интервью", "Запускаем поиск, проводим пробные собеседования, разбираем ответы и корректируем стратегию по результатам."],
];

export default function MentorshipPage() {
  return (
    <div className="shell py-12 lg:py-16">
      <section className="profession-hero grid gap-9 lg:grid-cols-[1fr_.72fr] lg:items-end">
        <div className="reveal">
          <p className="eyebrow flex items-center gap-2"><Target size={15} /> Персональная программа</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">Личное ведение <span className="headline-mark">до офера за 2 месяца</span></h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">Не универсальный курс, а маршрут под конкретного человека: анализ стартовой точки, выбор направления, индивидуальные тренировки, проекты, резюме и подготовка к реальным интервью.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="#application" className="button-primary">Оставить заявку</a><Link href="/professions" className="button-secondary">Сначала выбрать направление</Link></div>
        </div>
        <aside className="market-board rotate-0 p-6 reveal" style={{ animationDelay: "100ms" }}>
          <CalendarClock className="text-accent" size={28} />
          <strong className="mt-5 block font-mono text-5xl">20 ч</strong><span className="font-bold">в неделю</span>
          <p className="mt-4 leading-7 text-muted">В это время входят обучение, практика, работа над проектом, отклики и сами собеседования.</p>
          <div className="mt-5 border-t border-line pt-5 text-sm text-muted">Продолжительность · 8 недель</div>
        </aside>
      </section>

      <section className="mt-14 grid gap-5 md:grid-cols-3">
        {[
          [Compass, "Если направление не выбрано", "Сопоставим интересы, опыт и реальный спрос - и выберем роль осознанно."],
          [Dumbbell, "Персональные тренировки", "Задачи и обратная связь строятся вокруг ваших пробелов, а не средней программы."],
          [MessagesSquare, "Подготовка к интервью", "Технические и поведенческие тренировки, разбор ответов и стратегия поиска."],
        ].map(([Icon, title, copy], index) => {
          const StageIcon = Icon as typeof Compass;
          return <article key={String(title)} className="insight-card reveal" style={{ animationDelay: `${index * 80}ms` }}><span className="insight-icon"><StageIcon size={19} /></span><h2 className="mt-6 text-xl font-extrabold">{String(title)}</h2><p className="mt-3 leading-7 text-muted">{String(copy)}</p></article>;
        })}
      </section>

      <section className="mt-16">
        <div className="max-w-2xl"><p className="eyebrow">4 этапа за 8 недель</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Как устроена работа</h2></div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {stages.map(([period, title, copy], index) => <article key={period} className="panel panel-lift p-6 reveal" style={{ animationDelay: `${index * 70}ms` }}><div className="flex items-start gap-5"><span className="font-mono text-2xl font-bold text-accent">{period}</span><div><h3 className="text-xl font-extrabold">{title}</h3><p className="mt-2 leading-7 text-muted">{copy}</p></div></div></article>)}
        </div>
      </section>

      <section className="mt-14 grid gap-6 rounded-[1.6rem] border border-line bg-[rgb(var(--panel-rgb)/.64)] p-6 sm:p-8 lg:grid-cols-2">
        <div><p className="eyebrow">Что потребуется от вас</p><h2 className="mt-3 text-2xl font-extrabold">Это совместная работа, а не обещание без усилий</h2></div>
        <ul className="grid gap-3">{["Около 20 часов в неделю", "Готовность выполнять практику и принимать обратную связь", "Регулярные отклики и участие в собеседованиях", "Честность о сложностях и доступном времени"].map((item) => <li key={item} className="flex gap-3"><Check className="mt-0.5 shrink-0 text-positive" size={18} />{item}</li>)}</ul>
      </section>

      <section id="application" className="mt-16 scroll-mt-24"><MentorshipForm /><p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-5 text-muted">Два месяца - целевой горизонт программы. Конкретный срок получения офера зависит от стартового уровня, выбранной роли, активности кандидата и ситуации на рынке; офер не может быть гарантирован.</p></section>
    </div>
  );
}
