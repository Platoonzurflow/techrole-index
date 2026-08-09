import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Методология",
  description: "Как TechRole Index рассчитывает зарплаты, тренды, достоверность и итоговый индекс профессии.",
  alternates: { canonical: "/methodology" },
};

const components = [
  ["Спрос", "28%", "Percentile rank логарифма собственных HH-публикаций профессии"],
  ["Уровень зарплаты", "24%", "Percentile rank собственной gross RUB-медианы при n≥5"],
  ["Рост спроса", "16%", "Собственные последние 7 дней против предыдущих 7"],
  ["Доступность для начинающих", "12%", "Собственная доля noExperience, нормированная к 35%"],
  ["Удалённая работа", "10%", "Собственная доля удалённых HH-вакансий"],
  ["Стабильность и качество", "10%", "Собственные coverage зарплат и размер выборки"],
];

const faq = [
  ["Почему медиана и среднее показываются отдельно?", "Среднее сильнее реагирует на редкие экстремальные значения. Медиана описывает середину выборки, поэтому два показателя дополняют друг друга."],
  ["Что происходит, если зарплат мало?", "HH-модель использует все совместимые зарплаты профессии и показывает сегмент при n≥5. Если даже такого объёма нет, отдельно показывается ориентир открытого исследования."],
  ["Как считается зарплатная динамика?", "Для каждой профессии net приводится к gross, а односторонние границы оцениваются по типичной ширине полных вилок. Нижние 30% отсортированных зарплат относятся к Junior, следующие 55% — к Middle, верхние 15% — к Senior; каждая дневная точка показывает медиану сегмента за предшествующие 30 дней."],
  ["Что означает изменение за 7 дней?", "Сравнивается среднее число наблюдений за текущие семь дней со средним за предыдущие семь дней. Один день с предыдущим днём не сравнивается."],
  ["Смешиваются ли gross и net зарплаты?", "Не напрямую. В исходных счётчиках они разделены, а для основной HH-модели net сначала математически приводится к сопоставимому gross по прогрессивной шкале НДФЛ. Неизвестный налоговый статус в модель не включается."],
  ["Принимает ли локальная модель решения вместо правил?", "Нет. Основным остаётся объяснимый классификатор. Локальная модель может обработать ограниченное число неопределённых записей, её ответ валидируется и получает ограничение confidence."],
];

export default function MethodologyPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${siteUrl}/methodology#faq`,
    inLanguage: "ru-RU",
    mainEntity: faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return (
    <article className="shell py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">Версия scoring v1.2.0</p>
      <h1 className="mt-3 text-4xl font-bold">Как считаются показатели</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Индекс помогает сравнить профессии по одинаковым правилам. На результат влияют спрос, зарплата, динамика, доля Junior-вакансий, удалённая работа и полнота данных. На странице каждой профессии показан вклад каждого фактора в итоговые 100 баллов.</p>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold">Зарплатная статистика</h2>
          <div className="mt-5 grid gap-4 leading-7 text-muted">
            <p>Для каждой профессии отдельно считаются: все HH-вакансии с зарплатой, coverage, медиана, среднее, P25, P75, sample size и confidence. Одна вакансия входит в один зарплатный сегмент этой профессии.</p>
            <p><strong className="text-ink">Полная вилка → midpoint.</strong> Для нижней или верхней границы без пары центр оценивается по медианной ширине полных вилок этой же профессии. Благодаря этому односторонние объявления остаются в выборке, но их модельный статус явно указан.</p>
            <p>Net приводится к gross обратным расчётом действующей пятиступенчатой шкалы НДФЛ. USD, EUR и KZT переводятся в RUB по сохранённому официальному курсу ЦБ; записи с неизвестным налоговым статусом не подмешиваются.</p>
            <p>Для всех профессий используется одно правило: нижние 30% отсортированных зарплат относятся к Junior, диапазон от 30-го до 85-го процентиля — к Middle, верхние 15% — к Senior. Сегмент публикуется, когда в нём есть минимум пять наблюдений.</p>
            <p>Зарплаты сортируются и делятся на непрерывные сегменты: нижние 30% относятся к Junior, следующие 55% — к Middle, верхние 15% — к Senior. Для каждого сегмента показывается медиана в скользящем окне 30 дней; free получает до 30 дней истории, Premium — до 180 фактически накопленных.</p>
          </div>
        </section>
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold">Тренды</h2>
          <div className="mt-5 grid gap-4 leading-7 text-muted">
            <p>Стрелка не сравнивает соседние дни. Для периода N сравниваются средние текущего и предыдущего окна:</p>
            <p className="rounded-xl bg-slate-500/10 p-4 font-mono text-sm text-ink">Δ% = (avg current N − avg previous N) / max(avg current N, avg previous N) × 100</p>
            <p>Так шкала остаётся понятной: от −100% до +100%, даже если предыдущее окно было очень маленьким.</p>
            <ul className="grid gap-2"><li>↗ рост: больше +3%</li><li>→ нейтрально: от -3% до +3%</li><li>↘ падение: меньше -3%</li></ul>
            <p>Рассчитываются окна 7, 30 и 90 дней. Для 90-дневного сравнения нужны данные за последние 180 дней.</p>
          </div>
        </section>
      </div>
      <section className="mt-8 panel p-6">
        <h2 className="text-2xl font-semibold">Формула итоговой оценки</h2>
        <p className="mt-3 text-muted">Каждая профессия использует только свои классифицированные HH-вакансии: спрос, 14-дневную динамику, долю noExperience, удалённость и полноту зарплат. Зарплатный компонент использует медиану всех собственных сопоставимых gross-нормализованных записей при n≥5; при меньшем n получает нейтральную медиану достаточных peer-выборок, а качество данных остаётся низким. Категорийные строки в оценку не подставляются. Количество вакансий логарифмируется, денежные и growth-экстремумы ограничиваются 5/95 перцентилями, затем признаки переводятся в percentile rank среди активных профессий.</p>
        <div className="mt-6 table-wrap shadow-none">
          <table className="data-table"><thead><tr><th>Компонент</th><th>Вес</th><th>Нормализация</th></tr></thead><tbody>{components.map(([name, weight, method]) => <tr key={name}><td className="font-semibold">{name}</td><td className="font-mono">{weight}</td><td className="text-muted">{method}</td></tr>)}</tbody></table>
        </div>
        <p className="mt-5 rounded-xl border border-line p-4 font-mono text-sm">Score = 100 × Σ(weightᵢ × normalized_componentᵢ)</p>
        <p className="mt-4 text-muted">Breakdown и scoring_version сохраняются в <code>profession_scores_daily</code>. Новые веса создают новую версию, а не переписывают историю. Низкое качество данных остаётся видимым в badge и компоненте data quality.</p>
      </section>
      <section className="mt-8 panel p-6">
        <h2 className="text-2xl font-semibold">Классификация вакансий</h2>
        <p className="mt-4 leading-7 text-muted">Основной классификатор объясним: Unicode-нормализация заголовка → алиасы → регулярные выражения → исключения → поле опыта → маркеры junior/middle/senior на русском и английском → confidence. Team Lead, Principal и Architect не становятся Senior автоматически. Optional AI может только помочь с неопределёнными вакансиями и никогда не обязателен.</p>
      </section>
      <section className="mt-8 rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6">
        <h2 className="text-xl font-semibold">Источники и условия</h2>
        <p className="mt-3 leading-7 text-muted">Исторические метрики строятся воспроизводимо: для записей сохраняются источник, дата загрузки и версия правил. Открытый API «Работы России» используется для отдельного слоя официальных публикаций; одобренное приложение HH — для поискового снимка, подробных фасетов и индекса v1.2.0. Основная зарплатная модель использует только официальный HH API, сохранённые курсы ЦБ и публичную шкалу НДФЛ. HTML-скрейпинг и обход ограничений источников не применяются.</p>
        <Link href="/sources" className="mt-4 inline-block font-semibold text-accent">Подробнее об источниках →</Link>
      </section>
      <section id="faq" className="mt-8 scroll-mt-24">
        <p className="eyebrow">Короткие ответы</p>
        <h2 className="mt-2 text-3xl font-extrabold">Частые вопросы о расчётах</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">{faq.map(([question, answer]) => <article key={question} className="panel p-6"><h3 className="text-lg font-extrabold">{question}</h3><p className="mt-3 leading-7 text-muted">{answer}</p></article>)}</div>
        <Link href="/glossary" className="mt-6 inline-block font-semibold text-accent">Все определения →</Link>
      </section>
    </article>
  );
}
