import type { Metadata } from "next";
import Link from "next/link";
import { Crown } from "lucide-react";
import { Paywall } from "@/components/Paywall";
import { TrendBadge } from "@/components/TrendBadge";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Рейтинг IT-профессий",
  description: "Рейтинг профессий по спросу, зарплате, росту, доступности и удалённой работе с изменением спроса за неделю.",
  alternates: { canonical: "/top" },
};

export default async function TopPage() {
  const rows = await safeApi<ProfessionSummary[]>("/ranking", []);
  const isTeaser = rows.length <= 3;

  return (
    <div className="shell py-12">
      <p className="eyebrow flex items-center gap-2"><Crown size={15} /> TechRole Score</p>
      <h1 className="mt-3 text-4xl font-bold">Рейтинг IT-профессий</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">Оценка 0-100 сравнивает текущие рыночные сигналы по открытой формуле. Столбец «Спрос за 7 дней» показывает изменение среднего количества вакансий относительно предыдущих семи дней.</p>
      <div className="table-wrap mt-8">
        <table className="data-table">
          <thead><tr><th>Место</th><th>Профессия</th><th>Категория</th><th>Спрос за 7 дней</th><th className="text-right">Индекс</th></tr></thead>
          <tbody>
            {rows.map((item, index) => (
              <tr key={item.slug}>
                <td className="font-mono text-xl">{String(index + 1).padStart(2, "0")}</td>
                <td><Link href={`/professions/${item.slug}`} className="font-semibold hover:text-accent">{item.name_ru}</Link><div className="text-sm text-muted">{item.name_en}</div></td>
                <td className="text-muted">{item.category_name}</td>
                <td><TrendBadge trend={{ period_days: 7, change_percent: item.weekly_change_percent, direction: item.weekly_direction ?? "unknown" }} /></td>
                <td className="text-right font-mono text-2xl font-semibold">{item.score ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isTeaser ? <div className="mt-8"><Paywall compact title="Полный рейтинг из 50 профессий доступен в Premium" /></div> : null}
    </div>
  );
}
