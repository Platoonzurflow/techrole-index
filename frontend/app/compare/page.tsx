import type { Metadata } from "next";
import { CompareTool } from "@/components/CompareTool";
import { safeApi } from "@/lib/api";
import type { ProfessionSummary } from "@/lib/types";

export const metadata: Metadata = {
  title: "Сравнение профессий",
  description: "Сравните две или три IT-профессии по зарплате, спросу и индексу.",
  robots: { index: false },
};

export default async function ComparePage() {
  const professions = await safeApi<ProfessionSummary[]>("/professions", []);
  return (
    <div className="shell py-12">
      <p className="eyebrow">Premium-инструмент</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">Сравните направления на одном экране</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">Выберите две или три роли и сопоставьте индекс, зарплаты разных уровней и историю рынка. Полное сравнение доступно с Premium.</p>
      <CompareTool professions={professions} />
    </div>
  );
}
