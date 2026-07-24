import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Глоссарий аналитики IT-профессий",
  description: "Короткие определения медианы, перцентилей, salary coverage, confidence, трендов и других показателей TechRole Index.",
  alternates: { canonical: "/glossary" },
};

const terms = [
  ["Активная вакансия", "Вакансия, которую источник считает доступной на дату наблюдения и которая попала в текущий срез."],
  ["Расчётный объём вакансий", "Сопоставимый показатель подготовленной аналитической витрины. Он не подтверждает текущий остаток открытых вакансий."],
  ["Медиана", "Значение в середине упорядоченной выборки. Половина наблюдений ниже него, половина - выше."],
  ["Среднее", "Сумма значений, делённая на их количество. Чувствительно к очень высоким и очень низким значениям."],
  ["P25 и P75", "Границы центральных 50% наблюдений: 25% значений ниже P25, а 25% выше P75."],
  ["Midpoint", "Середина зарплатной вилки. Рассчитывается только когда известны обе границы: нижняя и верхняя."],
  ["Salary coverage", "Доля вакансий, в которых источник указал зарплату. Чем она выше, тем полнее денежная выборка."],
  ["Размер выборки", "Количество наблюдений, на которых основан показатель. В интерфейсе обозначается как n."],
  ["Confidence", "Оценка достаточности и качества данных с учётом выборки и покрытия зарплат."],
  ["Gross", "Зарплата до удержания налога."],
  ["Net", "Зарплата после удержания налога."],
  ["Тренд за 7 дней", "Сравнение среднего текущего семидневного окна со средним предыдущего семидневного окна."],
  ["Percentile rank", "Положение профессии относительно остальных: какая доля сравниваемых ролей находится ниже неё."],
  ["Удалённая доля", "Доля записей выбранного среза, в которых явно указан удалённый формат работы; смысл зависит от подписанного слоя данных."],
  ["Scoring version", "Версия формулы, весов и правил, по которым рассчитан индекс профессии."],
  ["Provenance", "Происхождение данных: источник, дата получения, условия использования и цепочка преобразований."],
];

export default function GlossaryPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const schema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Глоссарий TechRole Index",
    description: "Определения показателей аналитики рынка IT-профессий.",
    url: `${siteUrl}/glossary`,
    inLanguage: "ru-RU",
    hasDefinedTerm: terms.map(([name, description]) => ({
      "@type": "DefinedTerm",
      name,
      description,
      inDefinedTermSet: `${siteUrl}/glossary`,
    })),
  };
  return (
    <article className="shell py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <p className="eyebrow">Словарь показателей</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">Термины без лишнего жаргона</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Короткие определения помогают одинаково читать карточки профессий, графики и рейтинг.</p>
      <dl className="mt-10 grid gap-4 md:grid-cols-2">
        {terms.map(([term, definition]) => <div key={term} className="panel p-6"><dt className="text-xl font-extrabold">{term}</dt><dd className="mt-3 leading-7 text-muted">{definition}</dd></div>)}
      </dl>
      <div className="mt-10 flex flex-wrap gap-3"><Link className="button-primary" href="/methodology">Открыть методологию</Link><Link className="button-secondary" href="/sources">Проверить источники</Link></div>
    </article>
  );
}
