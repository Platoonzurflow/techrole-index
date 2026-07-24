import type { Metadata } from "next";
import { safeApi } from "@/lib/api";
import {
  russianFederalOpenDataTermsUrl,
  trudvsemOpenDataPageUrl,
} from "@/lib/data-licensing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Источники данных",
  description: "Источники, ограничения и условия использования данных TechRole Index.",
  alternates: { canonical: "/sources" },
};

interface Source {
  code: string;
  name: string;
  enabled: boolean;
  provider_type: string;
  terms_url?: string;
  methodology_url?: string;
  period?: string;
  salary_tax_status?: "gross" | "net" | "unknown";
}

function sourceTitle(source: Source) {
  return source.code === "demo" ? "Встроенный аналитический источник" : source.name;
}

function providerTitle(source: Source) {
  if (source.provider_type === "public_salary_report") return "Публичное исследование фактических доходов";
  return source.code === "demo" ? "Встроенный провайдер данных" : source.provider_type;
}

function sourceDescription(source: Source) {
  if (source.code === "cbr_currency") return `${source.enabled ? "Включённый" : "Выключенный"} источник официальных дневных курсов с requested/effective date.`;
  if (source.provider_type === "public_salary_report") return `Версионированный зарплатный ориентир за ${source.period}; налоговый статус: ${source.salary_tax_status === "net" ? "на руки" : "не указан"}. Не смешивается с вилками вакансий.`;
  return `${source.enabled ? "Включённый" : "Выключенный"} источник вакансий TechRole Index.`;
}

export default async function SourcesPage() {
  const sources = await safeApi<Source[]>("/sources", []);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const schema = {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": `${siteUrl}/#catalog`,
    name: "Источники TechRole Index",
    url: `${siteUrl}/sources`,
    inLanguage: "ru-RU",
    dataset: sources.map((source) => ({
      "@type": "Dataset",
      name: sourceTitle(source),
      description: sourceDescription(source),
      isBasedOn: source.terms_url,
      license: source.code === "trudvsem_open"
        ? russianFederalOpenDataTermsUrl
        : undefined,
      isAccessibleForFree: true,
    })),
  };

  return (
    <div className="shell py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">Data provenance</p>
      <h1 className="mt-3 text-4xl font-bold">Источники и условия использования</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">Архитектура отделяет расчёты от поставщиков данных: новый законный источник реализует общий <code>VacancyDataProvider</code>.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {sources.map((source) => (
          <article key={source.code} className="panel p-6">
            <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-semibold">{sourceTitle(source)}</h2><span className={`badge ${source.enabled ? "confidence-high" : "confidence-low"}`}>{source.enabled ? "включён" : "выключен"}</span></div>
            <p className="mt-3 font-mono text-sm text-muted">{providerTitle(source)}</p><p className="mt-3 text-sm leading-6 text-muted">{sourceDescription(source)}</p>
            {source.terms_url ? <a className="mt-5 inline-block font-semibold text-accent" href={source.terms_url} rel="noreferrer">Источник/документация ↗</a> : <p className="mt-5 text-muted">Синтетический источник без персональных данных.</p>}
            {source.methodology_url ? <a className="mt-3 block font-semibold text-accent" href={source.methodology_url} rel="noreferrer">Методология ↗</a> : null}
          </article>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border border-amber-400/35 bg-amber-400/5 p-6">
        <h2 className="text-xl font-semibold">Договорные API остаются выключенными</h2>
        <p className="mt-3 max-w-4xl leading-7 text-muted">Технически API hh.ru отдаёт вакансии с указанными работодателями зарплатами, но его условия не дают автоматического права собирать из них публичную стороннюю базу. TechRole Index включит provider только после письменного согласования агрегации, хранения и публикации, а также при <code>HH_ENABLED=true</code>, <code>HH_COMMERCIAL_USE_CONFIRMED=true</code>, app name и контактном email. API Хабр Карьеры также требует активированное OAuth-приложение; публичного метода массовой выгрузки зарплат в открытой документации нет. Поэтому сейчас используются только явно опубликованные агрегаты и отчёты, без HTML scraping, обхода входа или CAPTCHA.</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <a className="font-semibold text-accent" href="https://dev.hh.ru/admin/developer_agreement" rel="noreferrer">Условия API hh.ru ↗</a>
          <a className="font-semibold text-accent" href="https://career.habr.com/info/legal/api_rules" rel="noreferrer">Условия API Хабр Карьеры ↗</a>
        </div>
      </section>
      <section className="mt-8 panel p-6">
        <h2 className="text-xl font-semibold">Открытые данные «Работы России»</h2>
        <p className="mt-3 max-w-4xl leading-7 text-muted">Действующий observed pipeline использует только официальный JSON API портала и его документированный текстовый поиск. Контактные поля не сохраняются. Зарплаты с неизвестным gross/net-статусом остаются отдельными и не заменяют подготовленный gross-срез. Портал относит публикацию к открытым данным Роструда, требует ссылку на <code>trudvsem.ru</code> при копировании и связывает наборы с федеральными типовыми условиями использования.</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <a className="font-semibold text-accent" href="https://trudvsem.ru/opendata/api" rel="noreferrer">Документация открытого API ↗</a>
          <a className="font-semibold text-accent" href={trudvsemOpenDataPageUrl} rel="noreferrer">Страница наборов ↗</a>
          <a className="font-semibold text-accent" href={russianFederalOpenDataTermsUrl} rel="noreferrer">Типовые условия ↗</a>
        </div>
      </section>
      <section className="mt-8 panel p-6">
        <h2 className="text-xl font-semibold">Что никогда не собирается</h2>
        <ul className="mt-4 grid gap-2 text-muted"><li>- персональные данные соискателей;</li><li>- HTML-страницы, защищённые CAPTCHA;</li><li>- результаты через proxy rotation или обход лимитов;</li><li>- данные глубже доступных официальных ограничений API.</li></ul>
      </section>
    </div>
  );
}
