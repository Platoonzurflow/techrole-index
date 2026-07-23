import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SupportButton } from "@/components/SupportButton";
import { AnalyticsConsent } from "@/components/AnalyticsConsent";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "TechRole Index - аналитика IT-профессий", template: "%s - TechRole Index" },
  description: "Зарплаты Junior, Middle и Senior, спрос, тренды и прозрачный индекс 50 IT-профессий.",
  alternates: { canonical: "/" },
  authors: [{ name: "TechRole Index", url: siteUrl }],
  creator: "TechRole Index",
  publisher: "TechRole Index",
  keywords: ["IT-профессии", "зарплаты в IT", "вакансии", "Junior", "Middle", "Senior", "рейтинг IT-профессий", "стек технологий"],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TechRole Index",
    title: "TechRole Index - аналитика IT-профессий",
    description: "Сравнивайте зарплаты, спрос и динамику IT-профессий по прозрачной методологии.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "TechRole Index - аналитика IT-профессий",
    description: "Зарплаты, спрос, динамика и типичный стек 50 IT-профессий.",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "TechRole Index",
      url: siteUrl,
      email: "sqldevelopermoscow@yandex.com",
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "sqldevelopermoscow@yandex.com", availableLanguage: "Russian" },
      knowsAbout: ["IT-профессии", "рынок труда", "зарплаты в IT", "спрос на специалистов", "карьерная аналитика"],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "TechRole Index",
      url: siteUrl,
      inLanguage: "ru-RU",
      description: "Аналитика спроса, зарплат, динамики и технологического стека IT-профессий.",
      publisher: { "@id": `${siteUrl}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/professions?query={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "DataCatalog",
      "@id": `${siteUrl}/#catalog`,
      name: "Каталог аналитики IT-профессий TechRole Index",
      url: `${siteUrl}/professions`,
      description: "Публичные описания профессий, методология и доступные аналитические срезы.",
      inLanguage: "ru-RU",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM summary" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLM full public context" />
        <link rel="alternate" type="application/json" href="/ai-index.json" title="AI entity index" />
        <link rel="alternate" type="application/json" href="/insights.json" title="Editorial insights index" />
        <link rel="alternate" type="application/json" href="/answers.json" title="Answer-first market slices" />
        <link rel="alternate" type="application/ld+json" href="/open-data.json" title="Official open-data catalog" />
        <link rel="alternate" type="application/json" href="/open-data-daily.json" title="Observed publication daily data" />
        <link rel="alternate" type="text/csv" href="/open-data-daily.csv" title="Observed publication daily CSV" />
        <link rel="alternate" type="application/csvm+json" href="/open-data-daily.csv-metadata.json" title="Observed publication daily CSVW metadata" />
        <link rel="alternate" type="application/schema+json" href="/open-data-daily.schema.json" title="Observed publication daily JSON Schema" />
        <link rel="alternate" type={'application/ld+json; profile="http://mlcommons.org/croissant/1.1"'} href="/open-data-daily.croissant.json" title="Observed publication daily Croissant 1.1 metadata" />
        <link rel="alternate" type="application/ld+json" href="/catalog.jsonld" title="DCAT 3 open-data catalog" />
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="TechRole Index updates" />
        <link rel="alternate" type="application/vnd.citationstyles.csl+json" href="/citation.json" title="Citation metadata" />
        <link rel="alternate" type="application/x-bibtex" href="/citation.bib" title="BibTeX citation" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema).replace(/</g, "\\u003c") }} />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-panel focus:p-3">К содержимому</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <SupportButton />
        <AnalyticsConsent />
      </body>
    </html>
  );
}
