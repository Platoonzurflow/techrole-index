"use client";

import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_KEY,
  type AnalyticsConsentValue,
  storeAnalyticsConsent,
} from "@/components/AnalyticsConsent";

export function AnalyticsPreferences() {
  const [value, setValue] = useState<AnalyticsConsentValue | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
      setValue(stored === "accepted" || stored === "declined" ? stored : null);
    });
    return () => { active = false; };
  }, []);

  const choose = (next: AnalyticsConsentValue) => {
    storeAnalyticsConsent(next);
    setValue(next);
  };

  return <section className="mt-8 max-w-4xl rounded-2xl border border-line bg-panel p-5 sm:p-6" aria-labelledby="analytics-preferences-title">
    <h2 id="analytics-preferences-title" className="text-xl font-bold">Настройки аналитики</h2>
    <p className="mt-3 text-sm leading-6 text-muted">Текущий выбор: {value === "accepted" ? "аналитика разрешена" : value === "declined" ? "аналитика запрещена" : "выбор ещё не сделан"}. Отзыв сразу удаляет локальный идентификатор и прекращает новые события.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="button-primary" onClick={() => choose("accepted")}>Разрешить</button>
      <button type="button" className="button-secondary" onClick={() => choose("declined")}>Отозвать согласие</button>
    </div>
  </section>;
}
