import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "О проекте и редакционные принципы",
  description: "Кто отвечает за TechRole Index, как обновляются показатели и как сообщить об ошибке в данных.",
  alternates: { canonical: "/about" },
};

const principles = [
  ["Проверяемое основание", "У каждого показателя есть период, выборка, дата обновления и ссылка на методику."],
  ["Источники не смешиваются незаметно", "Источник и условия использования фиксируются до загрузки, а несовместимые salary-срезы разделяются."],
  ["Автоматизация под контролем", "Правила классификации остаются основными. Локальная модель помогает только с неопределёнными записями и не получает право публиковать вывод самостоятельно."],
  ["Ошибки можно исправить", "Замечание можно отправить через форму поддержки; обращение получает номер и сохраняется до ответа."],
];

export default function AboutPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "О TechRole Index",
    url: `${siteUrl}/about`,
    inLanguage: "ru-RU",
    about: { "@id": `${siteUrl}/#organization` },
    mainEntity: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "TechRole Index",
      url: siteUrl,
      email: "sqldevelopermoscow@yandex.com",
    },
  };
  return (
    <article className="shell py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">О проекте</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">Аналитика, за которую можно отвечать</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">TechRole Index помогает сравнивать IT-профессии по спросу, зарплатам и динамике. Сервис отделяет факты источника, расчёты и интерпретацию, чтобы вывод можно было проверить.</p>
      <section className="mt-10 grid gap-4 md:grid-cols-2">{principles.map(([title, copy]) => <article key={title} className="panel p-6"><h2 className="text-xl font-extrabold">{title}</h2><p className="mt-3 leading-7 text-muted">{copy}</p></article>)}</section>
      <section className="panel mt-8 p-6 sm:p-8"><h2 className="text-2xl font-extrabold">Обновления и исправления</h2><p className="mt-4 max-w-4xl leading-7 text-muted">Ночная оркестрация запускается в 00:00 по Москве. Результат каждой загрузки сохраняется в журнале ingestion runs. Новые данные не заменяют публичные показатели, пока не пройдены проверки происхождения, совместимости и размера выборки.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/status" className="button-primary">Статус данных</Link><Link href="/support" className="button-secondary">Сообщить об ошибке</Link></div></section>
    </article>
  );
}
