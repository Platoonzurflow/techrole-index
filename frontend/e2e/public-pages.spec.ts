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
  const batchSize = 4;
  for (let start = 0; start < routes.length; start += batchSize) {
    await Promise.all(routes.slice(start, start + batchSize).map(async (route) => {
      const response = await getWithTransientRetries(request, route);
      expect(response.status(), `${route} returned ${response.status()}`).toBeLessThan(400);
    }));
  }
}

test("public methodology is rendered and keyboard reachable", async ({ page }) => { await page.goto("/methodology"); await expect(page.getByRole("heading", { level: 1, name: "Как считаются показатели" })).toBeVisible(); await page.keyboard.press("Tab"); await expect(page.locator(":focus")).toBeVisible(); await expect(page.getByText("Midpoint", { exact: false }).first()).toBeVisible(); });

test("public profession SSR contains seeded level metrics", async ({ page }) => {
  await page.goto("/professions/python-developer");
  await expect(page.getByRole("heading", { level: 1, name: "Python-разработчик" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Медиана и среднее" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Junior" })).toBeVisible();
  await expect(page.getByText("n=", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Публикации за последние 180 дней" })).toBeVisible();
  await expect(page.getByText("Это не историческое число одновременно активных вакансий", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Зарплата по уровням за 180 дней" })).toBeVisible();
  await expect(page.getByText("gross/net не определён", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Рыночные ориентиры зарплаты" })).toBeVisible();
  await expect(page.getByText("технологический срез", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: "Junior" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: "Middle" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: "Senior" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Категорийный fallback" })).toHaveCount(0);
  await expect(page.getByText("n=45 226", { exact: false })).toBeVisible();
});

test("public calculator median is exact, sourced, and limitation-labeled", async ({ page }) => {
  await page.goto("/professions/data-scientist");
  await expect(page.getByRole("heading", { level: 1, name: "Data Scientist" })).toBeVisible();
  await expect(page.getByText("235 541 ₽", { exact: true })).toBeVisible();
  await expect(page.getByText("точная профессия", { exact: true })).toBeVisible();
  const source = page.locator('a[href*="spec_aliases%5B%5D=data_scientist"]');
  await expect(source).toBeVisible();
  await expect(source.locator("xpath=ancestor::article"))
    .toContainText("gross/net не указан");
});

test("status page exposes the salary source audit runtime state", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByRole("heading", { level: 1, name: "Статус обновления данных" }))
    .toBeVisible();
  await expect(page.getByText(/Аудит зарплатных источников: (enabled|disabled)/))
    .toBeVisible();
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
  await page.getByLabel("Имя", { exact: true }).fill("Тестовый кандидат");
  await page.getByLabel("Email или Telegram").fill("test@example.com");
  await page.locator('select[name="direction"]').selectOption("Backend");
  await page.locator('select[name="level"]').selectOption("Junior");
  await page.getByLabel("Что происходит сейчас и к чему хотите прийти", { exact: true }).fill("Проверка формы без отправки");
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Отправить заявку" })).toBeEnabled();
  await expect(page.getByText("sqldevelopermoscow@yandex.com")).toBeVisible();
});

test("cinematic hero supports search and touch interaction", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: /Сравните IT-профессии/ })).toBeVisible();
  const scene = page.getByRole("button", { name: "Показать карьерную трансформацию: деньги, деловой образ, сумка для ноутбука и офер" });
  await expect(page.getByText("Наведите или нажмите")).toHaveCount(0);
  await expect(page.getByText("Интерактивная карьерная сцена")).toHaveCount(0);
  await expect(scene).toHaveAttribute("aria-pressed", "false");
  await expect(scene).toBeEnabled();
  await scene.click();
  await expect(scene).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Название профессии").fill("Python");
  await page.getByRole("button", { name: "Найти профессию" }).click();
  await expect(page).toHaveURL(/\/professions\?query=Python/);
  await expect(page.getByRole("heading", { name: "Python-разработчик" })).toBeVisible();
});

test("light and dark career scenes have distinct intentional palettes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");
  const scene = page.locator(".career-scene");
  const lightPalette = await scene.evaluate((node) => ({
    background: getComputedStyle(node).backgroundImage,
    color: getComputedStyle(node).color,
    card: getComputedStyle(node.querySelector(".object-card")!).backgroundColor,
  }));
  expect(lightPalette.background).toContain("248, 246, 242");
  expect(lightPalette.color).toBe("rgb(29, 32, 39)");

  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  const darkPalette = await scene.evaluate((node) => ({
    background: getComputedStyle(node).backgroundImage,
    color: getComputedStyle(node).color,
    card: getComputedStyle(node.querySelector(".object-card")!).backgroundColor,
  }));
  expect(darkPalette.background).not.toBe(lightPalette.background);
  expect(darkPalette.color).not.toBe(lightPalette.color);
  expect(darkPalette.card).not.toBe(lightPalette.card);
});

test("mobile navigation keeps account reachable without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const mobileNavigation = page.getByRole("navigation", { name: "Мобильная навигация" });
  await expect(mobileNavigation.getByRole("link", { name: "Кабинет" })).toBeVisible();
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
  expect(payload.coverage).toEqual({ direct: 37, related: 11, category: 2 });
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
    "/", "/professions", "/top", "/pricing", "/mentorship", "/support",
    "/methodology", "/glossary", "/sources", "/about", "/status", "/compare",
    "/login", "/register", "/legal/offer", "/legal/refunds", "/legal/privacy", "/legal/consent", "/payments/error", "/payments/pending", "/llms.txt", "/.well-known/llms.txt", "/.well-known/linkset.json", "/.well-known/security.txt", "/llms-full.txt",
    "/ai-index.json", "/open-data.json", "/feed.xml", "/sitemap.xml", "/robots.txt",
    "/citation", "/citation.json", "/citation.bib", "/citation.ris", "/datapackage.json", "/catalog.jsonld",
    "/research", "/research.json", "/insights", "/insights.json",
    "/insights/median-vs-average-salary", "/insights/what-180-days-of-publications-means",
    "/insights/seniority-title-vs-experience-signals", "/insights/zero-matches-for-narrow-roles",
    "/insights/profession-index-0-100-not-a-promise", "/insights/server-side-paywall-ssr-json-ld",
    "/insights/llm-friendly-open-text-dataset-citation",
    "/insights/llm-friendly-open-text-dataset-citation/cite/csl-json",
    "/insights/llm-friendly-open-text-dataset-citation/cite/bibtex",
    "/insights/llm-friendly-open-text-dataset-citation/cite/ris",
    "/data-status", "/data-status.json", "/salary-benchmarks", "/salary-benchmarks.json", "/salary-benchmarks.csv", "/open-data.csv", "/open-data-daily",
    "/open-data-daily.json", "/open-data-daily.csv", "/open-data-daily.csv-metadata.json", "/open-data-daily.schema.json",
    "/open-data-daily.croissant.json",
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

  const openData = await (await request.get("/open-data.json")).json();
  expect(openData.dataset).toHaveLength(50);

  const citation = await (await request.get("/citation.json")).json();
  expect(citation.type).toBe("dataset");
  expect(citation.URL).toContain("/open-data.json");

  const dataPackage = await (await request.get("/datapackage.json")).json();
  expect(dataPackage.resources).toHaveLength(12);
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
  expect(insightIndex.articles).toHaveLength(12);
  expect(insightIndex.articles.every((article: { canonical_url: string }) => article.canonical_url.includes("/insights/"))).toBe(true);
  expect(insightIndex.articles.every((article: { citation_urls: { csl_json: string } }) => article.citation_urls.csl_json.endsWith("/cite/csl-json"))).toBe(true);

  const articleCitation = await (await request.get("/insights/llm-friendly-open-text-dataset-citation/cite/csl-json")).json();
  expect(articleCitation.type).toBe("webpage");
  expect(articleCitation.URL).toContain("/insights/llm-friendly-open-text-dataset-citation");
  const articleBib = await (await request.get("/insights/llm-friendly-open-text-dataset-citation/cite/bibtex")).text();
  const articleRis = await (await request.get("/insights/llm-friendly-open-text-dataset-citation/cite/ris")).text();
  expect(articleBib).toContain("@online{techrole_index_llm_friendly_open_text_dataset_citation");
  expect(articleRis).toContain("TY  - ELEC");

  const provenance = await (await request.get("/data-status.json")).json();
  expect(provenance.schema_version).toBe("1.3");
  expect(provenance.layers).toHaveLength(3);
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
  expect(salaryLayer.direct_professions).toBe(37);
  expect(salaryLayer.related_professions).toBe(11);
  expect(salaryLayer.category_only_professions).toBe(2);
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
