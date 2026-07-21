"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserCsrf } from "@/lib/browser";

export function AccountActions({ premium }: { premium: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const request = async (path: string) => {
    setMessage("Выполняется…");
    const response = await fetch(path, { method: "POST", headers: { "X-CSRF-Token": browserCsrf() } });
    if (!response.ok) { setMessage("Запрос не выполнен"); return; }
    if (path.endsWith("logout")) router.push("/"); else setMessage("Premium активирован на 30 дней.");
    router.refresh();
  };
  return <div className="mt-6 flex flex-wrap gap-3">{!premium ? <button type="button" className="button-primary" onClick={() => request("/api/v1/payments/demo/purchase")}>Активировать Premium</button> : null}<button type="button" className="button-secondary" onClick={() => request("/api/v1/auth/logout")}>Выйти</button>{message ? <p className="w-full text-sm text-muted" role="status">{message}</p> : null}</div>;
}
