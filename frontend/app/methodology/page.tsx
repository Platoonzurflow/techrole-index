import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Методология",
  description: "Как TechRole Index рассчитывает зарплаты, тренды, достоверность и итоговый индекс профессии.",
  alternates: { canonical: "/methodology" },
};

const components = [
  ["Спрос", "30%", "Percentile rank логарифма активных вакансий"],
  ["Уровень зарплаты", "25%", "Percentile rank winsorized медианы"],
  ["Рост спроса", "20%", "Percentile rank изменения спроса с ограничением экстремумов"],
  ["Доступность для начинающих", "10%", "Доля Junior, нормированная к 35%"],
  ["Удалённая работа", "10%", "Доля удалённых активных вакансий"],
  ["Стабильность и качество", "5%", "Coverage зарплат и размер выборки"],
];

const faq = [
  ["Почему медиана и среднее показываются отдельно?", "Среднее сильнее реагирует на редкие экстремальные значения. Медиана описывает середину выборки, поэтому два показателя дополняют друг друга."],
  ["Что происходит, если вилок мало?", "Медиана вакансий считается только при 20 полных вилках. До этого на странице показывается отдельный ориентир из открытого зарплатного исследования, а размер официальной выборки остаётся видимым."],
  ["Что означает изменение за 7 дней?", "Сравнивается среднее число наблюдений за текущие семь дней со средним за предыдущие семь дней. Один день с предыдущим днём не сравнивается."],
  ["Смешиваются ли gross и net зарплаты?", "Нет. Gross, net и неизвестный налоговый статус разделяются. Неизвестный статус не включается в явно обозначенный gross-срез."],
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
      <p className="eyebrow">Версия scoring v1.0.0</p>
      <h1 className="mt-3 text-4xl font-bold">Как считаются показатели</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Индекс помогает сравнить профессии по одинаковым правилам. На результат влияют спрос, зарплата, динамика, доля Junior-вакансий, удалённая работа и полнота данных. На странице каждой профессии показан вклад каждого фактора в итоговые 100 баллов.</p>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold">Зарплатная статистика</h2>
          <div className="mt-5 grid gap-4 leading-7 text-muted">
            <p>Для профессии, уровня, региона и периода отдельно считаются: вакансии, вакансии с зарплатой, coverage, медиана, среднее, P25, P75, медианы нижних и верхних границ, sample size и confidence.</p>
            <p><strong className="text-ink">Midpoint = (нижняя + верхняя) / 2</strong> используется только при наличии обеих границ. Единственная граница остаётся единственной - вторую мы не восстанавливаем.</p>
            <p>Gross, net и неизвестный налоговый статус не смешиваются. Интерфейс MVP показывает явно обозначенный gross-срез. Валюты переводятся отдельным rate provider с сохранением исходной валюты, курса, даты и провайдера.</p>
            <p>При менее чем 20 midpoint-наблюдениях медиана вакансий не публикуется. Вместо пустой карточки интерфейс показывает отдельно подписанный ориентир из открытого исследования. Порог задаётся через <code>MIN_SALARY_SAMPLE</code>.</p>
          </div>
        </section>
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold">Тренды</h2>
          <div className="mt-5 grid gap-4 leading-7 text-muted">
            <p>Стрелка не сравнивает соседние дни. Для периода N сравниваются средние текущего и предыдущего окна:</p>
            <p className="rounded-xl bg-slate-500/10 p-4 font-mono text-sm text-ink">Δ% = (avg current N - avg previous N) / avg previous N × 100</p>
            <ul className="grid gap-2"><li>↗ рост: больше +3%</li><li>→ нейтрально: от -3% до +3%</li><li>↘ падение: меньше -3%</li></ul>
            <p>Рассчитываются окна 7, 30 и 90 дней. Для 90-дневного сравнения нужны данные за последние 180 дней.</p>
          </div>
        </section>
      </div>
      <section className="mt-8 panel p-6">
        <h2 className="text-2xl font-semibold">Формула итоговой оценки</h2>
        <p className="mt-3 text-muted">Количество вакансий логарифмируется, денежные и growth-экстремумы ограничиваются 5/95 перцентилями, затем признаки переводятся в percentile rank среди активных профессий. Итог ограничивается диапазоном 0-100.</p>
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
        <p className="mt-3 leading-7 text-muted">Публичные исторические метрики пока основаны на воспроизводимом подготовленном наборе. Открытый API «Работы России» загружает реальные записи в отдельный provenance-контур, но не перезаписывает показатели до проверки совместимости зарплат. Официальный HH API выключен. Никакой HTML-скрейпинг, CAPTCHA/proxy/rate-limit обход не применяется.</p>
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
