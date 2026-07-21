import { expect, test, type Page } from "@playwright/test";

const budgets = {
  cls: Number(process.env.LAB_CLS_BUDGET ?? 0.1),
  fcpMs: Number(process.env.LAB_FCP_BUDGET_MS ?? 3_000),
  interactionMs: Number(process.env.LAB_INTERACTION_BUDGET_MS ?? 300),
  lcpMs: Number(process.env.LAB_LCP_BUDGET_MS ?? 4_000),
  ttfbMs: Number(process.env.LAB_TTFB_BUDGET_MS ?? 2_000),
};

const routes = ["/", "/professions/python-developer", "/insights/median-vs-average-salary"];

async function installObservers(page: Page) {
  await page.addInitScript(() => {
    const metrics = { cls: 0, eventDuration: 0, lcp: 0 };
    Object.defineProperty(window, "__techRoleLabMetrics", { value: metrics, writable: false });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) metrics.lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.eventDuration = Math.max(metrics.eventDuration, entry.duration);
    }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number });
  });
}

async function measureNavigation(page: Page, route: string) {
  await installObservers(page);
  const warmup = await page.goto(route);
  expect(warmup?.status(), `warmup ${route} status`).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  const response = await page.reload({ waitUntil: "load" });
  expect(response?.status(), `measured ${route} status`).toBeLessThan(400);
  await page.waitForTimeout(1_000);

  return page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const observed = (window as unknown as { __techRoleLabMetrics: { cls: number; lcp: number } }).__techRoleLabMetrics;
    return {
      cls: Number(observed.cls.toFixed(4)),
      fcpMs: Math.round(fcp),
      lcpMs: Math.round(observed.lcp),
      ttfbMs: Math.round(navigation?.responseStart ?? 0),
    };
  });
}

for (const route of routes) {
  test(`${route} stays within lab navigation budgets`, async ({ page }, testInfo) => {
    const metrics = await measureNavigation(page, route);
    await testInfo.attach("lab-navigation-metrics", {
      body: JSON.stringify({ budgets, metrics, route }, null, 2),
      contentType: "application/json",
    });
    console.log(`[lab-navigation] ${route} ${JSON.stringify(metrics)}`);

    expect(metrics.ttfbMs, `${route} TTFB`).toBeGreaterThan(0);
    expect(metrics.fcpMs, `${route} FCP`).toBeGreaterThan(0);
    expect(metrics.lcpMs, `${route} LCP`).toBeGreaterThan(0);
    expect(metrics.ttfbMs, `${route} TTFB`).toBeLessThanOrEqual(budgets.ttfbMs);
    expect(metrics.fcpMs, `${route} FCP`).toBeLessThanOrEqual(budgets.fcpMs);
    expect(metrics.lcpMs, `${route} LCP`).toBeLessThanOrEqual(budgets.lcpMs);
    expect(metrics.cls, `${route} CLS`).toBeLessThanOrEqual(budgets.cls);
  });
}

test("theme interaction stays within the lab response budget", async ({ page }, testInfo) => {
  await installObservers(page);
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Включить тёмную тему" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(150);

  const eventDuration = await page.evaluate(() => Math.round(
    (window as unknown as { __techRoleLabMetrics: { eventDuration: number } }).__techRoleLabMetrics.eventDuration,
  ));
  await testInfo.attach("lab-interaction-metrics", {
    body: JSON.stringify({ budgetMs: budgets.interactionMs, eventDurationMs: eventDuration }, null, 2),
    contentType: "application/json",
  });
  console.log(`[lab-interaction] theme ${eventDuration}ms`);
  expect(eventDuration).toBeLessThanOrEqual(budgets.interactionMs);
});
