import { expect, test, type Page } from "@playwright/test";

const representativeRoutes = [
  "/",
  "/professions",
  "/professions/python-developer",
  "/insights/median-vs-average-salary",
  "/data-status",
  "/open-data-daily",
  "/citation",
  "/support",
];

async function openPublicPage(page: Page, route: string) {
  const response = await page.goto(route);
  expect(response, `navigation did not return a response for ${route}`).not.toBeNull();
  expect(response!.status(), `${route} returned HTTP ${response!.status()}`).toBeLessThan(400);
  await page.waitForLoadState("domcontentloaded");
}

async function semanticIssues(page: Page) {
  return page.evaluate(() => {
    const issues: string[] = [];
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const labelledByText = (element: Element) => (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    const accessibleName = (element: Element) => [
      element.getAttribute("aria-label"),
      labelledByText(element),
      element.getAttribute("title"),
      element.textContent,
      element.querySelector("img")?.getAttribute("alt"),
    ].find((value) => value?.trim())?.trim() ?? "";

    if (document.documentElement.lang !== "ru") issues.push(`html lang is ${document.documentElement.lang || "missing"}`);
    if (document.querySelectorAll("main").length !== 1) issues.push(`expected one main, found ${document.querySelectorAll("main").length}`);
    if (document.querySelectorAll("h1").length !== 1) issues.push(`expected one h1, found ${document.querySelectorAll("h1").length}`);

    const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
    const duplicateIds = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
    if (duplicateIds.length) issues.push(`duplicate ids: ${duplicateIds.join(", ")}`);

    for (const image of document.querySelectorAll("img")) {
      if (!image.hasAttribute("alt")) issues.push(`image without alt: ${image.getAttribute("src") ?? "unknown"}`);
    }

    for (const control of document.querySelectorAll<HTMLElement>("button, a[href], [role='button']")) {
      if (visible(control) && !accessibleName(control)) {
        issues.push(`unnamed interactive element: ${control.outerHTML.slice(0, 120)}`);
      }
    }

    for (const field of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type='hidden']), select, textarea")) {
      if (!visible(field)) continue;
      const hasLabel = field.labels?.length || field.getAttribute("aria-label")?.trim() || labelledByText(field);
      if (!hasLabel) issues.push(`unlabelled form field: ${field.outerHTML.slice(0, 120)}`);
    }

    return issues;
  });
}

for (const route of representativeRoutes) {
  test(`${route} has baseline semantic accessibility`, async ({ page }) => {
    await openPublicPage(page, route);
    expect(await semanticIssues(page), `semantic issues on ${route}`).toEqual([]);
  });
}

test("skip link reaches the main content from the keyboard", async ({ page }) => {
  await openPublicPage(page, "/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "К содержимому" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("representative pages do not overflow a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of representativeRoutes) {
    await openPublicPage(page, route);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll, `horizontal overflow on ${route}`).toBeLessThanOrEqual(dimensions.client + 1);
  }
});

test("reduced motion removes long and repeating animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPublicPage(page, "/");
  const scene = page.locator(".career-scene");
  await scene.focus();

  const motion = await page.evaluate(() => {
    const seconds = (value: string) => value.split(",").map((part) => {
      const token = part.trim();
      return token.endsWith("ms") ? Number.parseFloat(token) / 1000 : Number.parseFloat(token);
    });
    const elements = [document.documentElement, ...document.querySelectorAll(".reveal, .career-scene, .money-note")];
    return elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        animation: seconds(style.animationDuration),
        iterations: style.animationIterationCount.split(",").map((value) => value.trim()),
        scroll: style.scrollBehavior,
        transition: seconds(style.transitionDuration),
      };
    });
  });

  expect(motion[0].scroll).toBe("auto");
  for (const item of motion) {
    expect(Math.max(...item.animation)).toBeLessThanOrEqual(0.001);
    expect(Math.max(...item.transition)).toBeLessThanOrEqual(0.001);
    expect(item.iterations).not.toContain("infinite");
  }
});
