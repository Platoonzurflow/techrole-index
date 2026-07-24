import type { Metadata } from "next";
import Link from "next/link";
import { safeApi } from "@/lib/api";
import { citationText, latestDataDate, type CitableOpenDataItem } from "@/lib/citation";

export const metadata: Metadata = {
  title: "Как цитировать TechRole Index",
  description: "Готовая ссылка и машиночитаемые форматы CSL-JSON, BibTeX, RIS и Data Package для данных TechRole Index.",
  alternates: { canonical: "/citation" },
};

const formats = [
  ["CSL-JSON", "/citation.json", "Для Zotero, reference managers и автоматической обработки."],
  ["BibTeX", "/citation.bib", "Для LaTeX, технических статей и репозиториев."],
  ["RIS", "/citation.ris", "Для библиографических менеджеров и импорта."],
  ["Data Package", "/datapackage.json", "Описание публичных JSON-ресурсов и их назначения."],
  ["CSV", "/open-data.csv", "Плоская таблица профессий и seniority-срезов с provenance."],
  ["Salary JSON", "/salary-benchmarks.json", "Ролевые, технологические и широкие зарплатные ориентиры с source-specific условиями."],
  ["Salary CSV", "/salary-benchmarks.csv", "Плоский зарплатный справочник со scope, tax status, периодом и первичным URL."],
  ["Daily dataset", "/open-data-daily", "Описание, словарь полей, охват и правила цитирования ежедневного observed-publication слоя."],
  ["Daily JSON", "/open-data-daily.json", "Нормализованные observed-publication срезы из инкрементальной SQL-витрины."],
  ["Daily CSV", "/open-data-daily.csv", "Переносимая плоская таблица daily creation-date срезов."],
  ["Daily JSON Schema", "/open-data-daily.schema.json", "Строгий контракт Draft 2020-12 для автоматической проверки метаданных и всех 27 полей строки."],
  ["Daily Croissant 1.1", "/open-data-daily.croissant.json", "MLCommons metadata для обнаружения и загрузки датасета AI/ML-инструментами."],
];

export default async function CitationPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const openData = await safeApi<CitableOpenDataItem[]>("/open-data/publications", []);
  const dateModified = latestDataDate(openData);
  const citation = citationText(siteUrl, dateModified);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "TechRole Index: аналитика IT-профессий и открытые данные о публикациях вакансий",
    description: "Публичные описания 50 IT-профессий, классифицированные публикации и отдельные зарплатные срезы официального открытого источника.",
    url: `${siteUrl}/citation`,
    sameAs: `${siteUrl}/open-data.json`,
    inLanguage: "ru-RU",
    dateModified,
    creator: { "@id": `${siteUrl}/#organization` },
    publisher: { "@id": `${siteUrl}/#organization` },
    citation,
    measurementTechnique: `${siteUrl}/methodology`,
    isBasedOn: "https://trudvsem.ru/opendata",
    subjectOf: {
      "@type": "CreativeWork",
      name: "JSON Schema ежедневного observed-publication датасета",
      url: `${siteUrl}/open-data-daily.schema.json`,
      encodingFormat: "application/schema+json",
    },
    distribution: [
      { "@type": "DataDownload", contentUrl: `${siteUrl}/open-data.json`, encodingFormat: "application/ld+json" },
      { "@type": "DataDownload", contentUrl: `${siteUrl}/open-data.csv`, encodingFormat: "text/csv" },
      { "@type": "DataDownload", contentUrl: `${siteUrl}/open-data-daily.json`, encodingFormat: "application/json" },
      { "@type": "DataDownload", contentUrl: `${siteUrl}/open-data-daily.csv`, encodingFormat: "text/csv" },
      { "@type": "DataDownload", contentUrl: `${siteUrl}/open-data-daily.croissant.json`, encodingFormat: "application/ld+json" },
      { "@type": "DataDownload", contentUrl: `${siteUrl}/ai-index.json`, encodingFormat: "application/json" },
    ],
  };

  return (
    <article className="shell py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">Проверяемая ссылка</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">Как цитировать TechRole Index</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Ссылка должна вести на каноническую страницу профессии или каталог открытых данных. Рядом с числом укажите период, размер выборки, дату обновления и источник.</p>

      <section className="panel mt-10 p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold">Рекомендуемая запись</h2>
        <p className="mt-4 rounded-xl border border-line bg-slate-500/5 p-4 font-mono text-sm leading-7" data-testid="recommended-citation">{citation}</p>
        <p className="mt-4 text-sm text-muted">Дата обновления: {dateModified ?? "будет указана после доступного ingestion status"}. Налоговый статус зарплат официального источника неизвестен и не должен называться gross или net.</p>
      </section>

      <section className="mt-8">
        <p className="eyebrow">Машиночитаемые форматы</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{formats.map(([title, href, copy]) => (
          <article key={href} className="panel p-6">
            <h2 className="text-xl font-extrabold">{title}</h2>
            <p className="mt-3 leading-7 text-muted">{copy}</p>
            <Link href={href} className="mt-4 inline-block font-semibold text-accent">Открыть {title} →</Link>
          </article>
        ))}</div>
      </section>

      <section className="panel mt-8 p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold">Минимум для корректной цитаты</h2>
        <ol className="mt-5 grid gap-3 leading-7 text-muted">
          <li><strong className="text-ink">1. Сущность:</strong> точное название профессии и ссылка на её каноническую страницу.</li>
          <li><strong className="text-ink">2. Измерение:</strong> публикации, медиана, среднее, P25/P75 или индекс нельзя подменять друг другом.</li>
          <li><strong className="text-ink">3. Контекст:</strong> период, seniority, валюта, размер выборки и дата обновления.</li>
          <li><strong className="text-ink">4. Provenance:</strong> TechRole Index как расчётный слой и исходный провайдер как источник наблюдений.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/methodology" className="button-primary">Методология</Link><Link href="/sources" className="button-secondary">Источники</Link><Link href="/data-status" className="button-secondary">Статус данных</Link><Link href="/open-data.json" className="button-secondary">Каталог JSON</Link><Link href="/open-data-daily" className="button-secondary">Ежедневный датасет</Link><Link href="/open-data-daily.json" className="button-secondary">Daily JSON</Link><Link href="/open-data-daily.csv" className="button-secondary">Daily CSV</Link><Link href="/open-data-daily.schema.json" className="button-secondary">JSON Schema</Link><Link href="/open-data-daily.croissant.json" className="button-secondary">Croissant 1.1</Link></div>
      </section>

      <section id="reuse" className="panel mt-8 p-6 sm:p-8">
        <p className="eyebrow">Повторное использование</p>
        <h2 className="mt-2 text-2xl font-extrabold">Атрибуция и условия первоисточника</h2>
        <p className="mt-4 max-w-4xl leading-7 text-muted">Можно ссылаться на страницы и цитировать отдельные показатели с указанием TechRole Index, канонического URL, периода, охвата и первичного источника. Права на исходные данные не передаются TechRole Index: перед массовым, коммерческим или производным использованием проверьте условия каждого источника на странице «Источники». Нельзя убирать provenance, менять смысл метрики или выдавать широкий срез за точную профессию.</p>
      </section>
    </article>
  );
}
