import { ImageResponse } from "next/og";
import { safeApi } from "@/lib/api";
import type { ProfessionDetail } from "@/lib/types";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profession = await safeApi<ProfessionDetail>(`/professions/${encodeURIComponent(slug)}?days=180`, {
    id: 0, slug, name_ru: "IT-профессия", name_en: "IT profession", description: "Рыночный срез TechRole Index", category_slug: "", category_name: "Рынок IT", is_premium: false, teaser_only: false,
  });
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px", background: "#0b0b0e", color: "white", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 800 }}>TechRole <span style={{ color: "#ef4444" }}>Index</span></div><div style={{ fontSize: 22, color: "#a1a1aa" }}>данные за 180 дней</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}><div style={{ fontSize: 24, color: "#f87171", fontWeight: 700 }}>{profession.category_name || "IT-профессия"}</div><div style={{ fontSize: 58, lineHeight: 1.08, fontWeight: 800, maxWidth: 1000 }}>{profession.name_ru}</div><div style={{ fontSize: 27, color: "#d4d4d8", maxWidth: 950 }}>{profession.description}</div></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #27272a", paddingTop: 22, fontSize: 24, color: "#a1a1aa" }}><span>зарплата · спрос · динамика</span><span style={{ color: "#fff", fontWeight: 700 }}>Индекс {profession.score ?? "—"}/100</span></div>
    </div>, { ...size },
  );
}
