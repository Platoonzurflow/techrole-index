"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareActions({ url, title, citation }: { url: string; title: string; citation: string }) {
  const [copied, setCopied] = useState<"url" | "citation" | null>(null);
  const copy = async (value: string, kind: "url" | "citation") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch { setCopied(null); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text: title, url }); return; } catch { return; }
    }
    await copy(url, "url");
  };
  return <div className="flex flex-wrap gap-2" aria-label="Поделиться страницей">
    <button type="button" className="button-secondary" data-analytics-event="share" onClick={share}><Share2 size={16} /> <span className="ml-2">{copied === "url" ? "Ссылка скопирована" : "Поделиться"}</span></button>
    <button type="button" className="button-secondary" data-analytics-event="citation_copy" onClick={() => copy(citation, "citation")}><span>{copied === "citation" ? <Check size={16} /> : <Copy size={16} />}</span><span className="ml-2">{copied === "citation" ? "Цитата скопирована" : "Скопировать цитату"}</span></button>
  </div>;
}
