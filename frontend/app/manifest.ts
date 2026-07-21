import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TechRole Index — аналитика IT-профессий",
    short_name: "TechRole Index",
    description: "Спрос, зарплаты, динамика и технологический стек 50 IT-профессий.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ff7a1a",
    lang: "ru-RU",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
