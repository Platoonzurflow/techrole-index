import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

async function getWithTransientRetries(
  request: APIRequestContext,
  route: string,
): Promise<APIResponse> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await request.get(route);
      if ((response.status() !== 429 && response.status() < 500) || attempt === 3) {
        return response;
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  throw new Error(`unreachable route retry state: ${route}`);
}

async function expectHealthyRoutes(request: APIRequestContext, routes: string[]) {
  // Next dev compiles dynamic SSR routes lazily. Serial crawling keeps the
  // public-contract audit stable under the same 2 GB memory limit as CI.
  const batchSize = 1;
  for (let start = 0; start < routes.length; start += batchSize) {
    await Promise.all(routes.slice(start, start + batchSize).map(async (route) => {
      const response = await getWithTransientRetries(request, route);
      expect(response.status(), `${route} returned ${response.status()}`).toBeLessThan(400);
    }));
  }
}

test("public trend percentages stay on the normalized scale", async ({ request }) => {
  const response = await getWithTransientRetries(request, "/api/v1/ranking");
  expect(response.ok()).toBe(true);
  const ranking = await response.json() as Array<{ weekly_change_percent?: number }>;
  expect(ranking.length).toBeGreaterThan(0);
  for (const item of ranking) {
    if (item.weekly_change_percent == null) continue;
    expect(item.weekly_change_percent).toBeGreaterThanOrEqual(-100);
    expect(item.weekly_change_percent).toBeLessThanOrEqual(100);
  }
});

test("public methodology is rendered and keyboard reachable", async ({ page }) => { await page.goto("/methodology"); await expect(page.getByRole("heading", { level: 1, name: "Как считаются показатели" })).toBeVisible(); await page.keyboard.press("Tab"); await expect(page.locator(":focus")).toBeVisible(); await expect(page.getByText("Midpoint", { exact: false }).first()).toBeVisible(); });

test("public profession SSR contains seeded level metrics", async ({ page }) => {
  await page.goto("/professions/python-developer");
  const salaryBenchmark = page.locator("#salary-benchmark");
  const hasHhSalary = await salaryBenchmark.getByRole("heading", { name: "Зарплата Junior, Middle и Senior" }).count() > 0;
  await expect(page.getByRole("heading", { level: 1, name: "Python-разработчик" })).toBeVisible();
  await expect(page.getByText("n=", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Публикации «Работы России»" })).toHaveCount(0);
  if (hasHhSalary) {
    await expect(page.getByRole("heading", { name: "Фактические доходы специалистов" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Зарплата Junior, Middle и Senior" })).toBeVisible();
    await expect(salaryBenchmark.getByText("Медиана в месяц · до вычета налогов", { exact: true })).toBeVisible();
    await expect(page.getByTestId("salary-median-showcase")).toHaveCount(0);
    await expect(salaryBenchmark).not.toContainText("вся зарплатная выборка · gross RUB");
    await expect(page.locator("#salary-history")).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Фактические доходы специалистов" })).toBeVisible();
    await expect(page.getByTestId("salary-median-showcase")).toBeVisible();
  }
  await expect(page.getByText("Для каждого уровня показано одно проверяемое значение", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 4, name: "Junior" })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 4, name: "Middle" })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 4, name: "Senior" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Категорийный fallback" })).toHaveCount(0);
  await expect(page.getByText("сохранены для проверки", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Поделиться" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Скопировать цитату" })).toBeVisible();
  await expect(salaryBenchmark).toBeVisible();
  await expect(page.locator("#salary-level-junior")).toBeVisible();
  await expect(page.locator("#publication-count-exact")).toHaveCount(0);
  await expect(page.locator("#observation-period")).toHaveCount(0);
  await expect(page.locator("#profession-sources")).toBeVisible();
});

test("free profession page exposes only the 30-day main chart", async ({ page }) => {
  await page.goto("/professions/python-developer");
  await expect(page.getByRole("heading", { name: "Доля публикаций с полной зарплатной вилкой" })).toHaveCount(0);
  await expect(page.locator("#salary-coverage")).toHaveCount(0);
  const salaryHistory = page.locator("#salary-history");
  const hasHhSalaryHistory = await salaryHistory.count() > 0;
  if (hasHhSalaryHistory) {
    await expect(page.getByRole("heading", { name: "Как менялась зарплата в вакансиях HH" })).toBeVisible();
    await expect(page.getByRole("button", { name: "30 дней" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "90 дней — доступно в Premium" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "180 дней — доступно в Premium" })).toBeDisabled();
  }
  await expect(page.getByText("Подготовленная аналитическая витрина", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", {
    name: "Расчётный спрос — не текущий остаток вакансий",
  })).toHaveCount(0);
  await expect(page.getByRole("img", {
    name: "Расчётный объём вакансий подготовленной витрины по уровням",
  })).toHaveCount(0);
  await expect(page.getByText("Графики вакансий за 180 дней — в Premium", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Расширенный ряд вакансий — в Premium", { exact: true })).toHaveCount(0);
  await expect(page.getByText("График вакансий за период более 30 дней — в Premium", { exact: true })).toHaveCount(0);
  await expect(page.locator("#publication-history")).toHaveCount(0);
  await expect(page.getByText("Слои, которые нельзя смешивать", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Продолжить исследование", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "История медианной зарплаты по уровням" }))
    .toHaveCount(0);
});

test("profession card stays readable on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/professions/dotnet-developer");

  await expect(page.locator("#salary-coverage")).toHaveCount(0);
  const selectors = [
    "#tech-stack",
    "#salary-benchmark",
    "#score-breakdown",
    "#market-skills",
  ];
  if (await page.locator("#salary-history").count() > 0) selectors.push("#salary-history");
  for (const selector of selectors) {
    const section = page.locator(selector);
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
  }

  const layout = await page.evaluate((sectionSelectors) => {
    const viewport = document.documentElement.clientWidth;
    return {
      viewport,
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      sectionsFit: sectionSelectors.every((selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect != null && rect.left >= -1 && rect.right <= viewport + 1;
      }),
      chartsFit: [...document.querySelectorAll(".chart-shell")].every((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.left >= -1 && rect.right <= viewport + 1;
      }),
      tocScrollable: getComputedStyle(document.querySelector(".profession-toc")!).overflowX === "auto",
      salaryLevelsFit: (() => {
        const rail = document.querySelector(".salary-level-grid") as HTMLElement | null;
        return rail != null
          && getComputedStyle(rail).overflowX !== "auto"
          && ["junior", "middle", "senior"].every((seniority) => {
            const rect = document.querySelector(`#salary-level-${seniority}`)?.getBoundingClientRect();
            return rect != null && rect.width > 0 && rect.left >= -1 && rect.right <= viewport + 1;
          });
      })(),
      mainChartHeight: document.querySelector("#salary-history .chart-shell")
        ?.getBoundingClientRect().height ?? 0,
    };
  }, selectors);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.sectionsFit).toBe(true);
  expect(layout.chartsFit).toBe(true);
  expect(layout.tocScrollable).toBe(true);
  expect(layout.salaryLevelsFit).toBe(true);
  if (selectors.includes("#salary-history")) {
    expect(layout.mainChartHeight).toBeGreaterThan(200);
    expect(layout.mainChartHeight).toBeLessThanOrEqual(280);
  } else {
    expect(layout.mainChartHeight).toBe(0);
  }
  expect(layout.pageHeight).toBeLessThan(12_000);
});

test("profession structured data cites only visible public datasets", async ({ page }) => {
  await page.goto("/professions/dotnet-developer");
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const nodes = schemas.flatMap((schema) => {
    const parsed = JSON.parse(schema);
    return parsed["@graph"] ?? [parsed];
  });
  const datasets = nodes.filter((node: { "@type"?: string }) => node["@type"] === "Dataset");
  const salary = datasets.find((node: { "@id"?: string }) => node["@id"]?.endsWith("#salary-benchmark"));
  const observed = datasets.find((node: { "@id"?: string }) => node["@id"]?.endsWith("#official-open-data"));

  expect(datasets.length).toBeGreaterThanOrEqual(2);
  expect(datasets.length).toBeLessThanOrEqual(3);
  expect(salary).toEqual(expect.objectContaining({
    isAccessibleForFree: true,
    license: expect.stringContaining("/citation#reuse"),
    citation: expect.arrayContaining([expect.stringMatching(/^https:\/\//)]),
    distribution: expect.arrayContaining([
      expect.objectContaining({ contentUrl: expect.stringContaining("/salary-benchmarks.json") }),
      expect.objectContaining({ contentUrl: expect.stringContaining("/salary-benchmarks.csv") }),
    ]),
  }));
  expect(observed).toEqual(expect.objectContaining({
    isAccessibleForFree: true,
    url: expect.stringMatching(/\/professions\/dotnet-developer#official-open-data$/),
    distribution: expect.arrayContaining([
      expect.objectContaining({ contentUrl: expect.stringContaining("/open-data.json") }),
      expect.objectContaining({ contentUrl: expect.stringContaining("/open-data.csv") }),
    ]),
  }));
  expect(JSON.stringify(datasets)).not.toMatch(/premium|market-metrics|\/api\/v1\/professions/i);
});

test("grade cards use one complete salary-ranked HH date without market substitution", async ({ page }) => {
  await page.goto("/professions/information-security-specialist");
  const benchmarkSection = page.locator("#salary-benchmark");
  await expect(page.locator("#salary-level-junior")).toBeVisible();
  if (await benchmarkSection.getByRole("heading", { name: "Зарплата Junior, Middle и Senior" }).count() === 0) {
    await expect(page.locator("#salary-level-middle")).toBeVisible();
    await expect(page.locator("#salary-level-senior")).toBeVisible();
    return;
  }
  await expect(page.getByTestId("salary-median-showcase")).toHaveCount(0);
  await expect(benchmarkSection).not.toContainText("HeadHunter - официальный API");
  await expect(benchmarkSection.getByText("модель HH · единый срез", { exact: true })).toHaveCount(0);
  await expect(page.locator("#salary-level-junior")).toContainText("n=");
  await expect(page.locator("#salary-level-middle")).toContainText("n=");
  await expect(page.locator("#salary-level-senior")).toContainText("n=");
  await expect(page.getByRole("heading", { name: "Доля публикаций с полной зарплатной вилкой" })).toHaveCount(0);

  await page.goto("/professions/it-project-manager");
  await expect(page.locator("#salary-history")).toBeVisible();
  await expect(page.locator("#salary-history")).not.toContainText("делятся на три сегмента");
});

test("weekly report and legal pages are publication-ready", async ({ page }) => {
  await page.goto("/reports/weekly");
  await expect(page.getByRole("heading", { level: 1, name: "Еженедельный отчёт рынка IT" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Подписаться на RSS" })).toHaveAttribute("href", "/feed.xml");

  await page.goto("/legal/offer");
  const sellerName = (await page.getByTestId("seller-full-name").textContent())?.trim() ?? "";
  expect(sellerName.length).toBeGreaterThan(0);

  const sellerNameExposure = { privacy: false, consent: false };
  await page.goto("/legal/privacy");
  sellerNameExposure.privacy = (await page.locator("main").innerText()).includes(sellerName);
  await expect(page.locator("main")).not.toContainText("ЗАПОЛНИТЬ");
  await expect(page.locator("main")).not.toContainText("ОПЕРАТОРУ");
  await expect(page.locator("main")).not.toContainText("проверяется владельцем");
  await expect(page.getByRole("link", { name: "публичной оферте" }))
    .toHaveAttribute("href", "/legal/offer");

  await page.goto("/legal/consent");
  sellerNameExposure.consent = (await page.locator("main").innerText()).includes(sellerName);
  expect(sellerNameExposure).toEqual({ privacy: false, consent: false });
});

test("HH salary uses one complete ranked sample while research remains a sparse fallback", async ({ page }) => {
  await page.goto("/professions/data-scientist");
  await expect(page.getByRole("heading", { level: 1, name: "Data Scientist" })).toBeVisible();
  const benchmarkSection = page.locator("#salary-benchmark");
  if (await benchmarkSection.getByRole("heading", { name: "Зарплата Junior, Middle и Senior" }).count() === 0) {
    await expect(page.getByRole("heading", { name: "Фактические доходы специалистов" })).toBeVisible();
    return;
  }
  await expect(page.getByTestId("salary-median-showcase")).toHaveCount(0);
  await expect(benchmarkSection).not.toContainText("HeadHunter - официальный API");
  await expect(benchmarkSection.getByText("модель HH · единый срез", { exact: true })).toHaveCount(0);
  await expect(benchmarkSection).not.toContainText("нет согласованного среза HH");
  await expect(page.locator("#salary-history")).not.toContainText("вся зарплатная выборка");

  await page.goto("/professions/information-security-specialist");
  const salaryHistory = page.locator("#salary-history");
  await expect(salaryHistory).not.toContainText("gross RUB в месяц");
  await expect(salaryHistory).not.toContainText("Junior от");
  await expect(salaryHistory).not.toContainText("Middle от");
  await expect(salaryHistory).not.toContainText("Senior от");
  await expect(salaryHistory).toContainText("точная профессия");
});

test("status page shows public freshness without internal runtime details", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByRole("heading", { level: 1, name: "Статус обновления данных" }))
    .toBeVisible();
  await expect(page.getByText("Последняя дата метрик")).toBeVisible();
  await expect(page.getByText("Последняя загрузка")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Redis");
  await expect(page.locator("main")).not.toContainText("Dagster");
});

test("support topics stay readable and keyboard selectable", async ({ page }) => {
  await page.goto("/support");
  const accountTopic = page.getByRole("radio", { name: "Аккаунт и вход Регистрация и доступ" });
  const dataTopic = page.getByRole("radio", { name: "Данные Показатели и обновления" });
  await expect(page.getByRole("group", { name: "Раздел" })).toBeVisible();
  await expect(accountTopic).toBeVisible();
  await expect(dataTopic).toBeVisible();
  await accountTopic.focus();
  await page.keyboard.press("Space");
  await expect(accountTopic).toBeChecked();
  await expect(dataTopic).not.toBeChecked();
});

test("popular profession card opens from its arrow area", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".profession-card");
  expect(await cards.count()).toBeGreaterThan(0);
  const card = cards.first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  const destination = await card.locator("a").getAttribute("href");
  const expectedDestination = new URL(destination!, page.url()).toString();
  const arrowLocator = card.locator(".card-arrow");
  await expect(arrowLocator).toBeVisible();
  const arrow = await arrowLocator.boundingBox();

  expect(destination).toBeTruthy();
  expect(arrow).toBeTruthy();
  await page.mouse.click(arrow!.x + arrow!.width / 2, arrow!.y + arrow!.height / 2);
  await expect(page).toHaveURL(expectedDestination);
});

test("mentorship application is complete without sending data", async ({ page }) => {
  await page.goto("/mentorship");
  await expect(page.getByRole("heading", { level: 1, name: /Личное ведение/ })).toBeVisible();
  await expect(page.getByText(/Предложите комфортную для вас стоимость/)).toBeVisible();
  await page.getByLabel("Имя", { exact: true }).fill("Тестовый кандидат");
  await page.getByLabel("Email или Telegram").fill("test@example.com");
  await page.locator('select[name="direction"]').selectOption("Backend");
  await page.locator('select[name="level"]').selectOption("Junior");
  await page.getByLabel("Предлагаемая стоимость, ₽").fill("30000");
  await page.getByLabel("Что происходит сейчас и к чему хотите прийти", { exact: true }).fill("Проверка формы без отправки");
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Отправить заявку" })).toBeEnabled();
  await expect(page.getByText("sqldevelopermoscow@yandex.com")).toBeVisible();
});

test("cinematic hero exposes the journey visual and profession search", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: /Из поиска к первому оферу/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Интерактивная планета с металлическими флагами Подготовка, Проекты и Интервью; при наведении отдельные плиты раскрывают обсидиановое ядро с золотой гравировкой Офер" })).toBeVisible();
  await expect(page.getByText("Подготовка", { exact: true })).toBeVisible();
  await expect(page.getByText("Проекты", { exact: true })).toBeVisible();
  await expect(page.getByText("Интервью", { exact: true })).toBeVisible();
  await expect(page.getByTestId("career-planet-core").getByText("Офер", { exact: true })).toHaveCount(1);
  await page.getByLabel("Название профессии").fill("Python");
  await page.getByRole("button", { name: "Найти профессию" }).click();
  await expect(page).toHaveURL(/\/professions\?query=Python/);
  await expect(page.getByRole("heading", { name: "Python-разработчик" })).toBeVisible();
});

test("light and dark career scenes have distinct intentional palettes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");
  const hero = page.locator(".cinematic-hero");
  const scene = page.locator(".career-journey-visual");
  const attachedFlags = page.locator('.career-3d-stage-flag[data-tile-attached="true"]');
  await expect(scene).toHaveAttribute("data-scene-ready", "true", { timeout: 5_000 });
  await expect(attachedFlags).toHaveCount(3, { timeout: 12_000 });
  const lightHeroPalette = await hero.evaluate((node) => ({
    background: getComputedStyle(node).backgroundImage,
    color: getComputedStyle(node).color,
  }));
  const lightPalette = {
    ...lightHeroPalette,
    sceneBackground: await scene.evaluate((node) => getComputedStyle(node).backgroundImage),
    flag: await attachedFlags.first().locator(".career-3d-flag-banner").evaluate(
      (node) => getComputedStyle(node).backgroundImage,
    ),
  };
  expect(lightPalette.color).toBe("rgb(20, 20, 22)");

  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  await expect(attachedFlags).toHaveCount(3, { timeout: 12_000 });
  const darkHeroPalette = await hero.evaluate((node) => ({
    background: getComputedStyle(node).backgroundImage,
    color: getComputedStyle(node).color,
  }));
  const darkPalette = {
    ...darkHeroPalette,
    sceneBackground: await scene.evaluate((node) => getComputedStyle(node).backgroundImage),
    flag: await attachedFlags.first().locator(".career-3d-flag-banner").evaluate(
      (node) => getComputedStyle(node).backgroundImage,
    ),
  };
  expect(darkPalette.background).not.toBe(lightPalette.background);
  expect(darkPalette.color).not.toBe(lightPalette.color);
  expect(darkPalette.sceneBackground).not.toBe(lightPalette.sceneBackground);
  expect(darkPalette.flag).not.toBe(lightPalette.flag);
});

test("catalog search controls use the dark palette", async ({ page }) => {
  await page.setViewportSize({ width: 943, height: 760 });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/professions");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(250);
  const search = page.locator(".career-search.profession-search-compact");
  const palette = await search.evaluate((node) => ({
    background: getComputedStyle(node).backgroundColor,
    input: getComputedStyle(node.querySelector("input")!).color,
    select: getComputedStyle(node.querySelector("select")!).color,
    selectTop: node.querySelector("select")!.getBoundingClientRect().top,
    selectHeight: node.querySelector("select")!.getBoundingClientRect().height,
    buttonTop: node.querySelector("button")!.getBoundingClientRect().top,
    buttonHeight: node.querySelector("button")!.getBoundingClientRect().height,
  }));
  expect(palette.background).toBe("rgb(21, 21, 23)");
  expect(palette.input).toBe("rgb(247, 247, 248)");
  expect(palette.select).toBe("rgb(237, 237, 240)");
  expect(Math.abs(
    palette.buttonTop + palette.buttonHeight / 2
      - (palette.selectTop + palette.selectHeight / 2),
  )).toBeLessThanOrEqual(1);
});

test("catalog direction immediately leaves only matching professions", async ({ page }) => {
  await page.goto("/professions");
  const direction = page.getByLabel("Направление");
  const order = await page.locator(".career-search").evaluate((form) => {
    const button = form.querySelector("button");
    const select = form.querySelector("select");
    return Boolean(
      button && select
      && (button.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
  });
  expect(order).toBe(true);

  await direction.selectOption("data-ai");
  await expect(page).toHaveURL(/\/professions\?.*category=data-ai/);
  const cards = page.locator(".profession-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
  for (const card of await cards.all()) {
    await expect(card).toContainText("Data & AI");
  }
});

test("premium tariff shows the previous price", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByLabel("Прежняя цена 1 349 рублей")).toHaveText("1 349 ₽");
  await expect(page.locator(".premium-old-price")).toHaveCSS("text-decoration-line", "line-through");
  await expect(page.locator(".premium-old-price")).toBeVisible();
});

test("answer-first page exposes stable, sourced citation fragments and JSON", async ({ page, request }) => {
  const response = await request.get("/answers.json");
  expect(response.status()).toBe(200);
  expect(response.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  expect(response.headers()["last-modified"]).toBeTruthy();
  const answers = await response.json();
  expect(answers.current_market_claim).toBe(false);
  expect(Array.isArray(answers.top_professions)).toBe(true);
  expect(answers.publication_data_available).toBe(answers.top_professions.length > 0);
  expect(answers.salary_by_level.length).toBeGreaterThan(0);
  expect(answers.salary_data_available).toBe(
    answers.salary_by_level.some((level: { roles: unknown[] }) => level.roles.length > 0),
  );
  expect(answers.methodology_url).toContain("/methodology");

  const notModified = await request.get("/answers.json", {
    headers: { "If-None-Match": response.headers().etag },
  });
  expect(notModified.status()).toBe(304);

  await page.goto("/answers#salary-by-level");
  await expect(page.getByRole("heading", { level: 1, name: /Короткие ответы/ })).toBeVisible();
  await expect(page.locator("#salary-by-level")).toBeVisible();
  await expect(page.locator("#top-professions")).toBeVisible();
  await expect(page.locator("#regions")).toBeVisible();
  await expect(page.locator("#dynamics")).toBeVisible();
  await expect(page.locator("#limitations")).toContainText("не равны одновременно активным вакансиям");
});

test("homepage search and career journey stay aligned in the dark theme", async ({ page }) => {
  await page.setViewportSize({ width: 1462, height: 822 });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);

  const search = page.locator(".cinematic-hero .career-search");
  const palette = await search.evaluate((node) => ({
    background: getComputedStyle(node).backgroundColor,
    input: getComputedStyle(node.querySelector("input")!).color,
  }));
  expect(palette.background).toBe("rgb(21, 21, 23)");
  expect(palette.input).toBe("rgb(247, 247, 248)");

  const dataScene = page.locator(".career-journey-visual");
  await expect(dataScene).toBeVisible();
  await expect(dataScene).toHaveAttribute("data-motion", "interactive-obsidian-flag-planet");
  await expect(dataScene).toHaveAttribute("data-scene-ready", "true", { timeout: 5_000 });
  const attachedFlags = page.locator('.career-3d-stage-flag[data-tile-attached="true"]');
  await expect(attachedFlags).toHaveCount(3, { timeout: 12_000 });
  const sceneLayout = await dataScene.evaluate((node) => {
    const scene = node.getBoundingClientRect();
    const planet = node.querySelector(".career-3d-planet-stage")!.getBoundingClientRect();
    const offer = node.querySelector(".career-3d-core-engraving")!.getBoundingClientRect();
    return {
      width: scene.width,
      height: scene.height,
      planetWidth: planet.width,
      offerInside: offer.left >= scene.left && offer.right <= scene.right
        && offer.top >= scene.top && offer.bottom <= scene.bottom,
      backdrop: getComputedStyle(node, "::before").backgroundImage,
    };
  });
  const headingFit = await page.locator(".cinematic-copy h1").evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(sceneLayout.width).toBeGreaterThan(500);
  expect(sceneLayout.height).toBeGreaterThan(500);
  expect(sceneLayout.planetWidth).toBeGreaterThan(500);
  expect(sceneLayout.offerInside).toBe(true);
  expect(sceneLayout.backdrop).not.toContain("linear-gradient");
  expect(headingFit.scrollWidth).toBeLessThanOrEqual(headingFit.clientWidth + 1);

  const pointerState = page.locator(".career-webgl-state");
  await expect(pointerState).toHaveAttribute("data-pointer-active", "false", { timeout: 12_000 });
  const attachedTiles = (await attachedFlags.evaluateAll((flags) => (
    flags.map((flag) => flag.getAttribute("data-anchor-tile"))
  ))).sort();
  expect(attachedTiles).toEqual(["59", "67", "69"]);
  const desktopFlagBoxes = await attachedFlags.evaluateAll((flags) => flags.map((flag) => {
    const box = flag.getBoundingClientRect();
    return { left: box.left, right: box.right };
  }));
  for (const box of desktopFlagBoxes) {
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(1463);
  }
  const flagBasesBefore = await page.locator(".career-3d-flag-base").evaluateAll((bases) => (
    bases.map((base) => {
      const box = base.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })
  ));
  const planetBox = await page.locator(".career-3d-planet-stage").boundingBox();
  expect(planetBox).not.toBeNull();
  await page.waitForTimeout(250);
  await page.mouse.move(
    planetBox!.x + planetBox!.width / 2 - 20,
    planetBox!.y + planetBox!.height / 2 - 20,
  );
  await page.mouse.move(
    planetBox!.x + planetBox!.width / 2,
    planetBox!.y + planetBox!.height / 2,
    { steps: 4 },
  );
  await expect(pointerState).toHaveAttribute("data-pointer-active", "true");
  await expect(dataScene).toHaveAttribute("data-interacting", "true");
  await expect(attachedFlags.first()).toHaveCSS("opacity", "0.42");
  const flagBasesAfter = await page.locator(".career-3d-flag-base").evaluateAll((bases) => (
    bases.map((base) => {
      const box = base.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })
  ));
  expect(Math.max(...flagBasesAfter.map((point, index) => Math.hypot(
    point.x - flagBasesBefore[index].x,
    point.y - flagBasesBefore[index].y,
  )))).toBeGreaterThan(4);
  await page.mouse.move(20, 120);
  await expect(pointerState).toHaveAttribute("data-pointer-active", "false");
  await expect(dataScene).toHaveAttribute("data-interacting", "false");
});

test("mobile navigation keeps account reachable without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const mobileNavigation = page.getByRole("navigation", { name: "Мобильная навигация" });
  await expect(mobileNavigation.getByRole("link", { name: "Кабинет" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Исследования" })).toHaveCount(0);
  await expect(mobileNavigation.getByRole("link", { name: "Методология" })).toHaveCount(0);
  await expect(page.locator("footer").getByRole("link", { name: "Исследования и разборы" })).toHaveAttribute("href", "/insights");
  await expect(page.locator("footer").getByRole("link", { name: "Методология" })).toHaveAttribute("href", "/methodology");
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  const mobileFlags = page.locator('.career-3d-stage-flag[data-tile-attached="true"]');
  await expect(mobileFlags).toHaveCount(3, { timeout: 12_000 });
  const mobileAttachedTiles = (await mobileFlags.evaluateAll((flags) => (
    flags.map((flag) => flag.getAttribute("data-anchor-tile"))
  ))).sort();
  expect(mobileAttachedTiles).toEqual(["58", "60", "68"]);
  const animationLayout = await page.locator(".cinematic-hero").evaluate((hero) => {
    const heroBox = hero.getBoundingClientRect();
    const searchBox = hero.querySelector(".career-search")!.getBoundingClientRect();
    const flagBoxes = Array.from(hero.querySelectorAll(".career-3d-stage-flag")).map((flag) => {
      const box = flag.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
    const sceneStyles = getComputedStyle(hero.querySelector(".career-planet-3d-universe")!);
    return {
      heroBottom: heroBox.bottom,
      searchBottom: searchBox.bottom,
      flagBoxes,
      userSelect: sceneStyles.userSelect,
      webkitUserSelect: sceneStyles.getPropertyValue("-webkit-user-select"),
    };
  });
  expect(animationLayout.userSelect).toBe("none");
  expect(animationLayout.webkitUserSelect).toBe("none");
  expect(Math.min(...animationLayout.flagBoxes.map((box) => box.top)))
    .toBeGreaterThanOrEqual(animationLayout.searchBottom + 4);
  for (const box of animationLayout.flagBoxes) {
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(dimensions.client + 1);
    expect(box.bottom).toBeLessThanOrEqual(animationLayout.heroBottom + 1);
  }
});

test("weekly research is answer-first, sourced and responsive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/insights/it-vacancy-publications-week-2026-07-18-2026-07-24");

  await expect(page.getByRole("heading", { level: 1, name: /71 публикация IT-вакансий/ })).toBeVisible();
  await expect(page.locator("#week-publications")).toContainText("71");
  await expect(page.locator("#week-change")).toContainText("−48,2%");
  await expect(page.getByRole("table")).toContainText("Системный администратор");
  await expect(page.getByRole("link", { name: "JSON со строками снимка" })).toHaveAttribute("href", "/open-data-daily.json");
  await expect(page.getByRole("link", { name: "CSL-JSON" })).toHaveAttribute("href", /\.csl\.json$/);
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((text) => {
    const parsed = JSON.parse(text);
    return parsed["@graph"] ?? [parsed];
  });
  expect(schemas).toEqual(expect.arrayContaining([
    expect.objectContaining({
      "@type": "Report",
      temporalCoverage: "2026-07-18/2026-07-24",
      isBasedOn: expect.stringContaining("/open-data-daily"),
    }),
  ]));
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
});

test("comparison builder has three clear pickers and stays responsive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/compare");
  await expect(page.getByRole("heading", { level: 2, name: "Соберите сравнение" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(3);
  await page.getByLabel("Профессия 3").selectOption({ label: "Python-разработчик" });
  await expect(page.getByLabel("Профессия 3")).toHaveValue("python-developer");
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
});

test("daily dataset landing explains, links and identifies the observed layer", async ({ page, request }) => {
  const dailyData = await (await request.get("/open-data-daily.json")).json();
  await page.goto("/open-data-daily");

  await expect(page.getByRole("heading", { level: 1, name: /Ежедневные публикации IT-вакансий/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Не число активных вакансий" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Null не равен нулю" })).toBeVisible();
  await expect(page.locator('a[href="/open-data-daily.json"]').first()).toBeVisible();
  await expect(page.locator('a[href="/open-data-daily.csv"]').first()).toBeVisible();
  await expect(page.locator('a[href="/open-data-daily.csv-metadata.json"]').first()).toBeVisible();
  await expect(page.locator('a[href="/open-data-daily.schema.json"]').first()).toBeVisible();
  await expect(page.locator('a[href="/open-data-daily.croissant.json"]').first()).toBeVisible();
  await expect(page.locator('a[href="/catalog.jsonld"]').first()).toBeVisible();

  const rowCount = Number((await page.getByTestId("dataset-row-count").innerText()).replace(/\D/g, ""));
  const publicationCount = Number((await page.getByTestId("dataset-publication-count").innerText()).replace(/\D/g, ""));
  expect(rowCount).toBe(dailyData.row_count);
  expect(publicationCount).toBe(dailyData.publication_count);

  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const nodes = schemas.flatMap((schema) => {
    const parsed = JSON.parse(schema);
    return parsed["@graph"] ?? [parsed];
  });
  const dataset = nodes.find((node: { "@type"?: string }) => node["@type"] === "Dataset");
  expect(dataset).toBeTruthy();
  expect(dataset.url).toContain("/open-data-daily");
  expect(dataset.additionalProperty).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "current_market_claim", value: false }),
  ]));
  expect(dataset.distribution).toEqual(expect.arrayContaining([
    expect.objectContaining({ contentUrl: expect.stringContaining("/open-data-daily.json") }),
    expect.objectContaining({ contentUrl: expect.stringContaining("/open-data-daily.csv") }),
  ]));
  expect(dataset.identifier).toBe("techrole-index:observed-publications-daily:v1");
  expect(dataset.datePublished).toBe("2026-07-20");
  expect(dataset.citation).toBeUndefined();
  expect(dataset.isBasedOn).toBe("https://trudvsem.ru/opendata/api");
  expect(dataset.subjectOf).toEqual(expect.arrayContaining([
    expect.objectContaining({
      url: expect.stringContaining("/open-data-daily.schema.json"),
      encodingFormat: "application/schema+json",
    }),
    expect.objectContaining({
      url: expect.stringContaining("/open-data-daily.csv-metadata.json"),
      encodingFormat: "application/csvm+json",
    }),
    expect.objectContaining({ url: expect.stringContaining("/catalog.jsonld") }),
  ]));
  const croissant = nodes.find((node: { "@type"?: string }) => node["@type"] === "sc:Dataset");
  expect(croissant).toBeTruthy();
  expect(croissant["dct:conformsTo"]).toBe("http://mlcommons.org/croissant/1.1");
  expect(croissant.license).toContain("/opendata/uslovia-od");
  expect(croissant.isLiveDataset).toBe(true);
  expect(croissant.recordSet[0].field).toHaveLength(30);
});

test("salary benchmark dataset is complete, downloadable, and limitation-labeled", async ({ page, request }) => {
  const jsonResponse = await request.get("/salary-benchmarks.json");
  expect(jsonResponse.status()).toBe(200);
  expect(jsonResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  const payload = await jsonResponse.json();
  expect(payload.status).toBe("public_reference");
  expect(payload.current_market_claim).toBe(false);
  expect(payload.profession_count).toBe(50);
  expect(payload.seniority_coverage).toEqual({ complete_roles: 50, points: 150 });
  expect(payload.coverage).toEqual({ direct: 29, related: 10, category: 11 });
  expect(payload.dataset).toHaveLength(50);
  expect(payload.dataset.every((item: Record<string, unknown>) =>
    JSON.stringify(Object.keys(item).sort()) === JSON.stringify([
      "benchmark", "category_slug", "name_en", "name_ru", "slug",
    ]))).toBe(true);

  const notModified = await request.get("/salary-benchmarks.json", {
    headers: { "If-None-Match": jsonResponse.headers().etag },
  });
  expect(notModified.status()).toBe(304);

  const csvResponse = await request.get("/salary-benchmarks.csv");
  expect(csvResponse.status()).toBe(200);
  expect(csvResponse.headers()["content-type"]).toContain("text/csv");
  const csv = await csvResponse.text();
  expect(csv.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]).toContain(
    "profession_slug,profession_name_ru,profession_name_en,category_slug,coverage",
  );
  expect(csv.split(/\r?\n/).filter(Boolean).length).toBeGreaterThan(200);

  await page.goto("/salary-benchmarks");
  await expect(page.getByRole("heading", { level: 1, name: /Зарплаты IT-специалистов/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Все профессии" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Скачать CSV" })).toBeVisible();
  await expect(page.getByText("Не смешивать с вакансиями", { exact: true })).toBeVisible();
  await expect(page.getByText("150 из 150", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);
});

test("public navigation and machine-readable endpoints have no broken links", async ({ page, request }) => {
  test.setTimeout(300_000);
  const publicRoutes = [
    "/", "/professions", "/top", "/companies", "/pricing", "/mentorship", "/support", "/answers", "/answers.json",
    "/methodology", "/glossary", "/sources", "/about", "/status", "/compare", "/reports/weekly",
    "/login", "/register", "/legal/offer", "/legal/refunds", "/legal/privacy", "/legal/consent", "/payments/error", "/payments/pending", "/llms.txt", "/.well-known/llms.txt", "/.well-known/linkset.json", "/.well-known/security.txt", "/llms-full.txt",
    "/ai-index.json", "/open-data.json", "/feed.xml", "/sitemap.xml", "/robots.txt",
    "/citation", "/citation.json", "/citation.bib", "/citation.ris", "/datapackage.json", "/catalog.jsonld",
    "/research", "/research.json", "/insights", "/insights.json",
    "/insights/it-vacancy-publications-week-2026-07-18-2026-07-24",
    "/insights/median-vs-average-salary", "/insights/what-180-days-of-publications-means",
    "/insights/seniority-title-vs-experience-signals", "/insights/zero-matches-for-narrow-roles",
    "/insights/profession-index-0-100-not-a-promise", "/insights/server-side-paywall-ssr-json-ld",
    "/insights/llm-friendly-open-text-dataset-citation",
    "/insight-citations/llm-friendly-open-text-dataset-citation.csl.json",
    "/insight-citations/llm-friendly-open-text-dataset-citation.bib",
    "/insight-citations/llm-friendly-open-text-dataset-citation.ris",
    "/data-status", "/data-status.json", "/salary-benchmarks", "/salary-benchmarks.json", "/salary-benchmarks.csv", "/open-data.csv", "/open-data-daily",
    "/open-data-daily.json", "/open-data-daily.csv", "/open-data-daily.csv-metadata.json", "/open-data-daily.schema.json",
    "/open-data-daily.croissant.json", "/hh-market-enrichment.json", "/hh-market-enrichment.csv",
  ];
  await expectHealthyRoutes(request, publicRoutes);

  const aiIndex = await (await request.get("/ai-index.json")).json();
  expect(aiIndex.entities).toHaveLength(50);
  expect(aiIndex.sources.length).toBeGreaterThan(0);
  expect(aiIndex.observed_publication_daily_page_url).toContain("/open-data-daily");
  expect(aiIndex.observed_publication_daily_csvw_url).toContain("/open-data-daily.csv-metadata.json");
  expect(aiIndex.observed_publication_daily_schema_url).toContain("/open-data-daily.schema.json");
  expect(aiIndex.observed_publication_daily_croissant_url).toContain("/open-data-daily.croissant.json");
  expect(aiIndex.observed_publication_linkset_url).toContain("/.well-known/linkset.json");
  expect(aiIndex.dcat_catalog_url).toContain("/catalog.jsonld");
  expect(aiIndex.salary_benchmarks_page_url).toContain("/salary-benchmarks");
  expect(aiIndex.salary_benchmarks_json_url).toContain("/salary-benchmarks.json");
  expect(aiIndex.salary_benchmarks_csv_url).toContain("/salary-benchmarks.csv");
  expect(aiIndex.hh_market_enrichment_dashboard_url).toContain("/companies");
  expect(aiIndex.hh_market_enrichment_json_url).toContain("/hh-market-enrichment.json");
  expect(aiIndex.hh_market_enrichment_csv_url).toContain("/hh-market-enrichment.csv");
  expect(aiIndex.answer_first_page_url).toContain("/answers");
  expect(aiIndex.answer_first_data_url).toContain("/answers.json");

  const aiIndexResponse = await request.get("/ai-index.json");
  expect(aiIndexResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  const aiIndexNotModified = await request.get("/ai-index.json", {
    headers: { "If-None-Match": aiIndexResponse.headers().etag },
  });
  expect(aiIndexNotModified.status()).toBe(304);

  const openData = await (await request.get("/open-data.json")).json();
  expect(openData.dataset).toHaveLength(50);

  const citation = await (await request.get("/citation.json")).json();
  expect(citation.type).toBe("dataset");
  expect(citation.URL).toContain("/open-data.json");

  const dataPackage = await (await request.get("/datapackage.json")).json();
  expect(dataPackage.resources).toHaveLength(16);
  expect(dataPackage.licenses[0].path).toContain("/opendata/uslovia-od");

  const dailyLandingResponse = await request.get("/open-data-daily");
  expect(dailyLandingResponse.headers().link).toContain(
    'rel="linkset"; type="application/linkset+json"',
  );
  const linksetResponse = await request.get("/.well-known/linkset.json");
  expect(linksetResponse.headers()["content-type"]).toContain("application/linkset+json");
  expect(linksetResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  const linkset = await linksetResponse.json();
  expect(linkset.linkset).toHaveLength(7);
  expect(linkset.linkset[0].anchor).toContain("/open-data-daily");
  expect(linkset.linkset[0].item).toEqual(expect.arrayContaining([
    expect.objectContaining({ href: expect.stringContaining("/open-data-daily.json") }),
    expect.objectContaining({ href: expect.stringContaining("/open-data-daily.csv") }),
  ]));
  const linksetNotModified = await request.get("/.well-known/linkset.json", {
    headers: { "If-None-Match": linksetResponse.headers().etag },
  });
  expect(linksetNotModified.status()).toBe(304);

  const dailyDataResponse = await request.get("/open-data-daily.json");
  const dailyData = await dailyDataResponse.json();
  const dailySchemaResponse = await request.get("/open-data-daily.schema.json");
  expect(dailySchemaResponse.headers()["content-type"]).toContain("application/schema+json");
  const dailySchema = await dailySchemaResponse.json();
  const requiredRecordFields = [...dailySchema.$defs.observedPublicationMetric.required].sort();
  expect(dailySchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  expect(dailySchema.$id).toContain("/open-data-daily.schema.json");
  expect(dailySchema.$defs.observedPublicationMetric.additionalProperties).toBe(false);
  expect(dailySchema.properties.records.items.$ref).toBe("#/$defs/observedPublicationMetric");
  expect(dailyDataResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  expect(dailyDataResponse.headers()["last-modified"]).toBeTruthy();
  expect(dailyDataResponse.headers()["access-control-expose-headers"]).toContain("ETag");
  const dailyNotModified = await request.get("/open-data-daily.json", {
    headers: { "If-None-Match": dailyDataResponse.headers().etag },
  });
  expect(dailyNotModified.status()).toBe(304);
  expect((await dailyNotModified.body()).length).toBe(0);
  const schemaNotModified = await request.get("/open-data-daily.schema.json", {
    headers: { "If-None-Match": `W/${dailySchemaResponse.headers().etag}` },
  });
  expect(schemaNotModified.status()).toBe(304);
  expect(dailyData.data_layer).toBe("observed_historical");
  expect(dailyData.metric_semantics).toBe("classified_publications_by_creation_date");
  expect(dailyData.current_market_claim).toBe(false);
  expect(dailyData.schema_url).toContain("/open-data-daily.schema.json");
  expect(dailySchema.required.every((field: string) => Object.hasOwn(dailyData, field))).toBe(true);
  expect(dailyData.records).toHaveLength(dailyData.row_count);
  expect(dailyData.records.every((row: Record<string, unknown>) =>
    JSON.stringify(Object.keys(row).sort()) === JSON.stringify(requiredRecordFields))).toBe(true);
  expect(dailyData.records.every((row: { current_market_claim: boolean }) => row.current_market_claim === false)).toBe(true);
  const dailyCsvResponse = await request.get("/open-data-daily.csv");
  const dailyCsv = await dailyCsvResponse.text();
  expect(dailyCsvResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  expect(dailyCsvResponse.headers()["last-modified"]).toBe(
    dailyDataResponse.headers()["last-modified"],
  );
  const dailyCsvNotModified = await request.get("/open-data-daily.csv", {
    headers: { "If-Modified-Since": dailyCsvResponse.headers()["last-modified"] },
  });
  expect(dailyCsvNotModified.status()).toBe(304);
  expect(dailyCsv.split(/\r?\n/).filter(Boolean)).toHaveLength(dailyData.row_count + 1);
  expect(dailyCsv).toContain("metric_date,source_code,source_name");
  expect(dailyCsvResponse.headers().link).toContain(
    'rel="describedby"; type="application/csvm+json"',
  );

  const csvwResponse = await request.get("/open-data-daily.csv-metadata.json");
  expect(csvwResponse.headers()["content-type"]).toContain("application/csvm+json");
  expect(csvwResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  const csvw = await csvwResponse.json();
  expect(csvw["@context"][0]).toBe("http://www.w3.org/ns/csvw");
  expect(csvw.url).toContain("/open-data-daily.csv");
  expect(csvw.tableSchema.columns).toHaveLength(30);
  expect(csvw.tableSchema.columns.map((column: { name: string }) => column.name)).toEqual(
    dailyCsv.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0].split(","),
  );
  expect(csvw.tableSchema.primaryKey).toHaveLength(7);
  const csvwNotModified = await request.get("/open-data-daily.csv-metadata.json", {
    headers: { "If-None-Match": csvwResponse.headers().etag },
  });
  expect(csvwNotModified.status()).toBe(304);

  const croissantResponse = await request.get("/open-data-daily.croissant.json");
  expect(croissantResponse.headers()["content-type"]).toContain(
    'application/ld+json; profile="http://mlcommons.org/croissant/1.1"',
  );
  expect(croissantResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  const croissant = await croissantResponse.json();
  expect(croissant["dct:conformsTo"]).toBe("http://mlcommons.org/croissant/1.1");
  expect(croissant.distribution[0].contentSize).toMatch(/^\d+ B$/);
  expect(croissant.recordSet[0].field).toHaveLength(30);
  expect(croissant.recordSet[0].field.map((field: { name: string }) => field.name)).toEqual(
    dailyCsv.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0].split(","),
  );
  const croissantNotModified = await request.get("/open-data-daily.croissant.json", {
    headers: { "If-None-Match": croissantResponse.headers().etag },
  });
  expect(croissantNotModified.status()).toBe(304);

  const dcatResponse = await request.get("/catalog.jsonld");
  expect(dcatResponse.headers()["content-type"]).toContain("application/ld+json");
  expect(dcatResponse.headers().etag).toMatch(/^"sha256-[a-f0-9]{64}"$/);
  const dcat = await dcatResponse.json();
  expect(dcat["@type"]).toBe("dcat:Catalog");
  expect(dcat["dcat:dataset"]["@type"]).toBe("dcat:Dataset");
  expect(dcat["dcat:dataset"]["dcat:distribution"]).toHaveLength(2);
  expect(dcat["dcat:service"]["@type"]).toBe("dcat:DataService");
  const dcatNotModified = await request.get("/catalog.jsonld", {
    headers: { "If-None-Match": dcatResponse.headers().etag },
  });
  expect(dcatNotModified.status()).toBe(304);

  const insightIndex = await (await request.get("/insights.json")).json();
  expect(insightIndex.articles).toHaveLength(13);
  expect(insightIndex.articles.every((article: { canonical_url: string }) => article.canonical_url.includes("/insights/"))).toBe(true);
  expect(insightIndex.articles.every((article: { citation_urls: { csl_json: string } }) => article.citation_urls.csl_json.endsWith(".csl.json"))).toBe(true);

  const weeklyResearch = insightIndex.articles.find((article: { kind?: string }) => article.kind === "research");
  expect(weeklyResearch).toMatchObject({
    slug: "it-vacancy-publications-week-2026-07-18-2026-07-24",
    publishedAt: "2026-07-25",
    snapshot: {
      period: "2026-07-18/2026-07-24",
      comparisonPeriod: "2026-07-11/2026-07-17",
    },
  });
  expect(weeklyResearch.snapshot.metrics).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "week-publications", value: "71" }),
    expect.objectContaining({ id: "week-change", value: "−48,2%" }),
  ]));

  const researchCitation = await (await request.get("/insight-citations/it-vacancy-publications-week-2026-07-18-2026-07-24.csl.json")).json();
  expect(researchCitation.type).toBe("report");
  expect(researchCitation.URL).toContain("/insights/it-vacancy-publications-week-2026-07-18-2026-07-24");
  const researchBib = await (await request.get("/insight-citations/it-vacancy-publications-week-2026-07-18-2026-07-24.bib")).text();
  const researchRis = await (await request.get("/insight-citations/it-vacancy-publications-week-2026-07-18-2026-07-24.ris")).text();
  expect(researchBib).toContain("@techreport{techrole_index_it_vacancy_publications_week_2026_07_18_2026_07_24");
  expect(researchRis).toContain("TY  - RPRT");

  const articleCitation = await (await request.get("/insight-citations/llm-friendly-open-text-dataset-citation.csl.json")).json();
  expect(articleCitation.type).toBe("webpage");
  expect(articleCitation.URL).toContain("/insights/llm-friendly-open-text-dataset-citation");
  const articleBib = await (await request.get("/insight-citations/llm-friendly-open-text-dataset-citation.bib")).text();
  const articleRis = await (await request.get("/insight-citations/llm-friendly-open-text-dataset-citation.ris")).text();
  expect(articleBib).toContain("@online{techrole_index_llm_friendly_open_text_dataset_citation");
  expect(articleRis).toContain("TY  - ELEC");

  const provenance = await (await request.get("/data-status.json")).json();
  expect(provenance.schema_version).toBe("1.4");
  expect(provenance.layers).toHaveLength(4);
  expect(provenance.layers.every((layer: { current_market_claim: boolean }) => layer.current_market_claim === false)).toBe(true);
  expect(provenance.observed_publication_daily_page_url).toContain("/open-data-daily");
  expect(provenance.observed_publication_daily_csvw_url).toContain("/open-data-daily.csv-metadata.json");
  expect(provenance.observed_publication_daily_schema_url).toContain("/open-data-daily.schema.json");
  expect(provenance.observed_publication_daily_croissant_url).toContain("/open-data-daily.croissant.json");
  expect(provenance.dcat_catalog_url).toContain("/catalog.jsonld");
  const officialLayer = provenance.layers.find((layer: { id: string }) => layer.id === "official_publications");
  const salaryLayer = provenance.layers.find((layer: { id: string }) => layer.id === "salary_benchmarks");
  expect(officialLayer.window_time_basis).toBe("UTC_calendar_days");
  expect(officialLayer.window_start_at).toMatch(/T00:00:00(?:Z|\+00:00)$/);
  expect(officialLayer.window_end_at_exclusive).toMatch(/T00:00:00(?:Z|\+00:00)$/);
  expect(salaryLayer.profession_count).toBe(50);
  expect(salaryLayer.direct_professions).toBe(29);
  expect(salaryLayer.related_professions).toBe(10);
  expect(salaryLayer.category_only_professions).toBe(11);
  expect(salaryLayer.latest_total_sample_size).toBe(45226);

  const openDataCsv = await (await request.get("/open-data.csv")).text();
  expect(openDataCsv.split(/\r?\n/).filter(Boolean)).toHaveLength(151);
  expect(openDataCsv).toContain("salary_tax_status");

  const research = await (await request.get("/research.json")).json();
  expect(research.type).toBe("Report");
  expect(
    research.summary.represented_professions
      + research.summary.zero_result_professions,
  ).toBe(50);
  expect(research.summary.total_publications).toBe(officialLayer.classified_publications);

  const llmsFull = await (await request.get("/llms-full.txt")).text();
  expect(llmsFull.match(/^### /gm)).toHaveLength(50);

  await page.goto("/professions");
  const hrefs = await page.locator('a[href^="/"]').evaluateAll((links) =>
    [...new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")!).filter(Boolean))],
  );
  expect(hrefs.length).toBeGreaterThanOrEqual(50);
  const professionHrefs = hrefs.filter((href) => href.startsWith("/professions/"));
  expect(professionHrefs).toHaveLength(50);
  await expectHealthyRoutes(request, professionHrefs);
});
