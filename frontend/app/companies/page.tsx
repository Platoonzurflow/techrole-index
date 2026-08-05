import type { Metadata } from "next";
import { CompaniesExplorer } from "@/components/CompaniesExplorer";
import { safeApi } from "@/lib/api";
import type { OpenDataCatalogItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Какие компании нанимают IT-специалистов — дашборд HH",
  description: "Топ-5 работодателей и группа «Другие компании» по каждой из 50 IT-профессий на основе официального поискового снимка HH API.",
  alternates: { canonical: "/companies" },
};

export default async function CompaniesPage() {
  const items = await safeApi<OpenDataCatalogItem[]>("/open-data/publications", []);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const withEmployers = items.filter((item) => item.hh_market_data?.hh_enrichment?.employer_distribution.length);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${siteUrl}/companies#dataset`,
    name: "Работодатели в IT-вакансиях по профессиям — TechRole Index",
    description: "Агрегированный топ-5 работодателей и группа «Другие компании» для каждой IT-профессии в официальном поисковом снимке HH API.",
    url: `${siteUrl}/companies`,
    isAccessibleForFree: true,
    inLanguage: "ru-RU",
    creator: { "@type": "Organization", name: "TechRole Index", url: siteUrl },
    isBasedOn: "https://api.hh.ru/openapi/redoc",
    variableMeasured: ["Количество вакансий работодателя", "Доля работодателя", "Число компаний", "Покрытие подробных карточек"],
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${siteUrl}/hh-market-enrichment.json` },
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${siteUrl}/hh-market-enrichment.csv` },
    ],
  };
  return (
    <main className="shell py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll("<", "\\u003c") }} />
      <header className="profession-hero mb-8">
        <p className="eyebrow">Компании · HH API</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold sm:text-5xl">Кто нанимает в каждой IT-профессии</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Выберите профессию и посмотрите топ-5 компаний по числу классифицированных вакансий. Остальные работодатели объединены в одну группу, чтобы сохранить ясную картину рынка.</p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted"><span className="badge">{withEmployers.length} профессий с данными</span><span className="badge">обновляется автоматически</span><span className="badge">без текстов и контактов</span></div>
      </header>
      <CompaniesExplorer items={items} />
      <section className="panel mt-8 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Как читать дашборд</h2>
        <p className="mt-3 max-w-4xl leading-7 text-muted">Считаются классифицированные вакансии в ограниченном поисковом снимке, а не все вакансии HH и не текущий штат компаний. Одна компания учитывается по публичному идентификатору работодателя. Исходные описания, контакты и адреса не сохраняются и не публикуются.</p>
      </section>
    </main>
  );
}
