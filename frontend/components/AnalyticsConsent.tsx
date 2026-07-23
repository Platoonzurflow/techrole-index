"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const ANALYTICS_CONSENT_KEY = "techrole_analytics_consent";
export const ANALYTICS_VISITOR_KEY = "techrole_analytics_visitor";
export type AnalyticsConsentValue = "accepted" | "declined";
type Consent = AnalyticsConsentValue | null;

export function storeAnalyticsConsent(value: AnalyticsConsentValue) {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  if (value === "declined") localStorage.removeItem(ANALYTICS_VISITOR_KEY);
  window.dispatchEvent(new CustomEvent("techrole-analytics-consent", { detail: value }));
}

function visitorId() {
  const existing = localStorage.getItem(ANALYTICS_VISITOR_KEY);
  if (existing && /^[A-Za-z0-9_-]{20,80}$/.test(existing)) return existing;
  const created = crypto.randomUUID().replaceAll("-", "");
  localStorage.setItem(ANALYTICS_VISITOR_KEY, created);
  return created;
}

function referrerHost() {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    return host === window.location.hostname.toLowerCase() ? undefined : host;
  } catch {
    return undefined;
  }
}

function sendAnalytics(eventType: "pageview" | "click" | "citation_copy" | "share", path: string, targetPath?: string) {
  const body = JSON.stringify({
    visitor_id: visitorId(),
    event_type: eventType,
    path,
    target_path: targetPath,
    referrer_host: referrerHost(),
  });
  void fetch("/api/v1/analytics/events", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => undefined);
}

export function AnalyticsConsent() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const lastPageview = useRef("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
      setConsent(stored === "accepted" || stored === "declined" ? stored : null);
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const update = (event: Event) => {
      const value = (event as CustomEvent<AnalyticsConsentValue>).detail;
      if (value === "accepted" || value === "declined") setConsent(value);
    };
    window.addEventListener("techrole-analytics-consent", update);
    return () => window.removeEventListener("techrole-analytics-consent", update);
  }, []);

  useEffect(() => {
    if (consent !== "accepted" || lastPageview.current === pathname) return;
    lastPageview.current = pathname;
    sendAnalytics("pageview", pathname);
  }, [consent, pathname]);

  useEffect(() => {
    if (consent !== "accepted") return;
    const trackClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      const explicit = element.closest<HTMLElement>("[data-analytics-event]");
      const explicitType = explicit?.dataset.analyticsEvent;
      if (explicitType === "citation_copy" || explicitType === "share") {
        sendAnalytics(explicitType, window.location.pathname);
        return;
      }
      const anchor = element.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      try {
        const target = new URL(anchor.href, window.location.href);
        if (target.origin !== window.location.origin) return;
        sendAnalytics("click", window.location.pathname, `${target.pathname}${target.hash}`);
      } catch {
        return;
      }
    };
    document.addEventListener("click", trackClick, { capture: true });
    return () => document.removeEventListener("click", trackClick, { capture: true });
  }, [consent]);

  const choose = (value: Exclude<Consent, null>) => {
    storeAnalyticsConsent(value);
    setConsent(value);
  };

  if (!ready || consent !== null) return null;
  return <aside className="analytics-consent" aria-labelledby="analytics-consent-title">
    <div>
      <strong id="analytics-consent-title">Помочь улучшать TechRole Index?</strong>
      <p>С вашего согласия сайт анонимно считает посещения и переходы. IP, email, содержимое форм и платёжные данные не записываются. <Link href="/legal/privacy">Подробнее</Link>.</p>
    </div>
    <div className="flex shrink-0 flex-wrap gap-2"><button type="button" className="button-primary" onClick={() => choose("accepted")}>Разрешить аналитику</button><button type="button" className="button-secondary" onClick={() => choose("declined")}>Не разрешать</button></div>
  </aside>;
}
