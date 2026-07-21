import { ImageResponse } from "next/og";

export const alt = "TechRole Index — аналитика 50 IT-профессий";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", color: "#f7f7f8", background: "linear-gradient(135deg, #09090b 0%, #18181b 58%, #2a170b 100%)", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "30px", fontWeight: 800 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "58px", height: "58px", borderRadius: "16px", background: "#ff7a1a", color: "#111113", fontSize: "27px" }}>TI</div>
        <span>TechRole Index</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ maxWidth: "980px", fontSize: "68px", lineHeight: 1.03, letterSpacing: "-2px", fontWeight: 900 }}>Сравните IT-профессии. Выберите направление по данным.</div>
        <div style={{ fontSize: "30px", color: "#c8c8cf" }}>Спрос, зарплаты, динамика, стек и прозрачная методология</div>
      </div>
      <div style={{ display: "flex", gap: "16px", fontSize: "23px", color: "#f1c6a5" }}>
        <span>50 профессий</span><span>•</span><span>Junior / Middle / Senior</span><span>•</span><span>Открытые данные</span>
      </div>
    </div>,
    size,
  );
}
