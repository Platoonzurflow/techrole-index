import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfessionCard } from "@/components/ProfessionCard";
import { TrendBadge } from "@/components/TrendBadge";
import { buildMentorshipMailto, MENTORSHIP_EMAIL, MentorshipForm } from "@/components/MentorshipForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CompareTool } from "@/components/CompareTool";
import { SupportButton } from "@/components/SupportButton";
import { SupportForm } from "@/components/SupportForm";
import { CareerTransformationHero } from "@/components/CareerTransformationHero";
import { AccountActions } from "@/components/AccountActions";
import { officialSalaryLevelsAreCoherent, SalaryBenchmarks } from "@/components/SalaryBenchmarks";
import { AdminPanel } from "@/components/AdminPanel";
import { ProfessionSearch } from "@/components/ProfessionSearch";
import { ShareActions } from "@/components/ShareActions";
import { AlertsPanel } from "@/components/AlertsPanel";
import { PremiumHeaderStatus } from "@/components/PremiumHeaderStatus";
import { AnalyticsConsent } from "@/components/AnalyticsConsent";
import { AnalyticsPreferences } from "@/components/AnalyticsPreferences";

const { routerPush, routerRefresh } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  usePathname: () => "/professions/data-engineer",
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.className = "";
  routerPush.mockReset();
  routerRefresh.mockReset();
});

describe("analytics components", () => {
  it("records consented pageviews and internal clicks without sensitive fields", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", request);
    render(<><AnalyticsConsent /><a href="/answers#salary-by-level" onClick={(event) => event.preventDefault()}>Срез зарплат</a></>);

    fireEvent.click(await screen.findByRole("button", { name: "Разрешить аналитику" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const pageview = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(pageview).toMatchObject({ event_type: "pageview", path: "/professions/data-engineer" });
    expect(pageview.visitor_id).toMatch(/^[A-Za-z0-9_-]{20,80}$/);
    expect(pageview).not.toHaveProperty("email");
    expect(pageview).not.toHaveProperty("ip");

    fireEvent.click(screen.getByRole("link", { name: "Срез зарплат" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toMatchObject({
      event_type: "click",
      path: "/",
      target_path: "/answers#salary-by-level",
    });
  });

  it("does not create a visitor id or send events after analytics is declined", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    render(<AnalyticsConsent />);

    fireEvent.click(await screen.findByRole("button", { name: "Не разрешать" }));
    await act(async () => undefined);
    expect(request).not.toHaveBeenCalled();
    expect(localStorage.getItem("techrole_analytics_visitor")).toBeNull();
  });

  it("allows analytics consent to be withdrawn from privacy preferences", async () => {
    localStorage.setItem("techrole_analytics_consent", "accepted");
    localStorage.setItem("techrole_analytics_visitor", "visitor_identifier_000000000001");
    render(<AnalyticsPreferences />);
    expect(await screen.findByText(/аналитика разрешена/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Отозвать согласие" }));
    expect(localStorage.getItem("techrole_analytics_consent")).toBe("declined");
    expect(localStorage.getItem("techrole_analytics_visitor")).toBeNull();
    expect(screen.getByText(/аналитика запрещена/)).toBeVisible();
  });

  it("keeps search suggestions and category filter in one GET form", () => {
    const requestSubmit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => undefined);
    render(<ProfessionSearch compact initialQuery="Data" initialCategory="data-ai" suggestions={[{ slug: "data-engineer", name_ru: "Инженер по данным", name_en: "Data Engineer" }]} categories={[{ slug: "data-ai", name: "Data & AI" }]} />);

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/professions");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByDisplayValue("Data")).toHaveAttribute("name", "query");
    expect(screen.getByDisplayValue("Data & AI")).toHaveAttribute("name", "category");
    expect(screen.getByDisplayValue("Data & AI").closest(".app-select-shell")).not.toBeNull();
    const suggestionValues = Array.from(document.querySelectorAll("datalist option")).map((option) => option.getAttribute("value"));
    expect(suggestionValues).toEqual(expect.arrayContaining(["Инженер по данным", "Data Engineer"]));
    const submit = screen.getByRole("button", { name: "Найти профессию" });
    const direction = screen.getByDisplayValue("Data & AI");
    expect(submit.compareDocumentPosition(direction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(direction, { target: { value: "" } });
    expect(requestSubmit).toHaveBeenCalledOnce();
  });

  it("shows admin-only payment readiness without rendering provider secrets", async () => {
    const privatePassword = "provider-password-must-not-render";
    const request = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{
          id: 1,
          slug: "data-engineer",
          name_ru: "Инженер по данным",
          name_en: "Data Engineer",
          is_premium: false,
          is_active: true,
        }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          provider: "robokassa",
          mode: "test",
          payments_enabled: false,
          test_ready: false,
          live_ready: false,
          test_checks: [
            { code: "credentials", label: "Заданы тестовые параметры магазина", ready: false },
          ],
          live_checks: [
            { code: "owner_confirmation", label: "Владелец разрешил реальные списания", ready: false },
          ],
          result_url: "https://techrole.example/api/v1/payments/webhooks/robokassa",
        }),
      });
    vi.stubGlobal("fetch", request);

    render(<AdminPanel />);

    expect(await screen.findByText("Готовность Robokassa")).toBeInTheDocument();
    expect(screen.getByText("Реальные списания заблокированы")).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/techrole\.example\/api\/v1\/payments/)).toBeInTheDocument();
    expect(screen.queryByText(privatePassword)).not.toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/api/v1/admin/payment-readiness",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows the exact benchmark without a separate category fallback block", () => {
    render(<SalaryBenchmarks data={{
      coverage: "direct",
      methodology_note: "Слои не смешиваются.",
      points: [
        { source_id: "habr", scope: "exact_role", label: "Инженер по данным", geography: "russia", metric: "median", value: 240000, p10: 100000, p90: 413000, is_fallback: false },
        { source_id: "habr", scope: "category", label: "Аналитика", geography: "russia", metric: "median", value: 194000, is_fallback: true },
        { source_id: "habr", scope: "category", label: "Аналитика", geography: "moscow", metric: "median", value: 220000, is_fallback: true },
        { source_id: "habr", scope: "category", label: "Аналитика", geography: "saint_petersburg", metric: "median", value: 180000, is_fallback: true },
        { source_id: "habr", scope: "category", label: "Аналитика", geography: "regions", metric: "median", value: 160000, is_fallback: true },
      ],
      sources: [{
        id: "habr",
        name: "Хабр Карьера",
        url: "https://habr.com/ru/specials/1060148/",
        methodology_url: "https://career.habr.com/info/salaries",
        period: "I полугодие 2026",
        published_at: "2026-07-21",
        total_sample_size: 45226,
        currency: "RUB",
        tax_status: "net",
        income_type: "salary_plus_bonus",
        methodology_note: "Фактические доходы.",
      }],
    }} />);

    expect(screen.getByText("есть прямой срез")).toBeInTheDocument();
    expect(screen.getByText("точная профессия")).toBeInTheDocument();
    expect(screen.queryByText("Категорийный fallback")).not.toBeInTheDocument();
    expect(screen.getByText(/n=45[\s\u00a0]226/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Источник/ })).toHaveAttribute(
      "href",
      "https://habr.com/ru/specials/1060148/",
    );
  });

  it("fills Junior, Middle and Senior from a sourced study when vacancy samples are small", () => {
    const sources = [{
      id: "survey",
      name: "Публичный зарплатный опрос",
      url: "https://example.org/survey",
      methodology_url: "https://example.org/survey",
      period: "I полугодие 2026",
      published_at: "2026-05-28",
      total_sample_size: 1539,
      currency: "RUB" as const,
      tax_status: "unknown" as const,
      income_type: "salary" as const,
      methodology_note: "Открытый опрос.",
    }];
    const benchmark = {
      coverage: "category" as const,
      methodology_note: "Лучший доступный срез.",
      points: ([
        ["junior", 114500],
        ["middle", 200000],
        ["senior", 310000],
      ] as const).map(([seniority, value]) => ({
        source_id: "survey",
        scope: "market_level" as const,
        label: "IT-специалисты в России",
        geography: "russia" as const,
        metric: "median" as const,
        value,
        seniority,
        is_fallback: true,
      })),
      sources,
    };
    const official = {
      source_name: "Работа России",
      source_url: "https://trudvsem.ru/opendata/api",
      period_days: 180,
      date_from: "2026-01-24",
      date_to: "2026-07-22",
      total_publications: 3,
      salary_disclosed_count: 3,
      remote_count: 0,
      confidence_level: "low" as const,
      daily_publications: [],
      category_total_publications: 3,
      category_daily_publications: [],
      salary_currency: "RUB" as const,
      salary_gross_status: "unknown" as const,
      salary_min_sample: 3,
      salary_by_seniority: (["junior", "middle", "senior"] as const).map((seniority) => ({
        seniority,
        vacancy_count: 1,
        salary_count: 1,
        salary_coverage: 1,
        sample_size: 1,
        confidence_level: "insufficient" as const,
      })),
      salary_history: [],
      salary_history_reference_median: 200000,
      salary_history_reference_scope: "category" as const,
      salary_history_minimum_ratio: { junior: 0.4, middle: 0.7, senior: 1 },
      salary_history_minimum_salary: { junior: 80000, middle: 140000, senior: 200000 },
      salary_methodology_note: "Только полные вилки.",
      methodology_note: "Публикации.",
    };

    render(<SalaryBenchmarks data={benchmark} official={official} />);

    const headings = screen.getAllByRole("heading", { level: 4 }).map((item) => item.textContent);
    expect(headings).toEqual(["Junior", "Middle", "Senior"]);
    expect(screen.getByText("114 500 ₽")).toBeInTheDocument();
    expect(screen.getByText("200 000 ₽")).toBeInTheDocument();
    expect(screen.getByText("310 000 ₽")).toBeInTheDocument();
    expect(screen.queryByText("Недостаточно данных")).not.toBeInTheDocument();
  });

  it("uses one coherent source when official level medians are inverted", () => {
    const official = {
      source_name: "Работа России",
      source_url: "https://trudvsem.ru/opendata/api",
      period_days: 180,
      date_from: "2026-01-25",
      date_to: "2026-07-23",
      total_publications: 300,
      salary_disclosed_count: 129,
      remote_count: 4,
      confidence_level: "high" as const,
      daily_publications: [],
      category_total_publications: 300,
      category_daily_publications: [],
      salary_currency: "RUB" as const,
      salary_gross_status: "unknown" as const,
      salary_min_sample: 3,
      salary_by_seniority: [
        { seniority: "junior" as const, vacancy_count: 9, salary_count: 9, salary_coverage: 1, sample_size: 9, median: 115000, confidence_level: "medium" as const },
        { seniority: "middle" as const, vacancy_count: 97, salary_count: 97, salary_coverage: 1, sample_size: 97, median: 100000, confidence_level: "high" as const },
        { seniority: "senior" as const, vacancy_count: 23, salary_count: 23, salary_coverage: 1, sample_size: 23, median: 89300, confidence_level: "high" as const },
      ],
      salary_history: [],
      salary_history_reference_median: 200000,
      salary_history_reference_scope: "category" as const,
      salary_history_minimum_ratio: { junior: 0.4, middle: 0.7, senior: 1 },
      salary_history_minimum_salary: { junior: 80000, middle: 140000, senior: 200000 },
      salary_methodology_note: "Только полные вилки.",
      methodology_note: "Публикации.",
    };
    const benchmark = {
      coverage: "direct" as const,
      methodology_note: "Сопоставимый уровневый срез.",
      points: [
        { source_id: "grades", scope: "market_level" as const, label: "Разработчики", geography: "russia" as const, metric: "range" as const, lower: 100000, upper: 130000, seniority: "junior" as const, sample_size: 55, is_fallback: true },
        { source_id: "grades", scope: "market_level" as const, label: "Разработчики", geography: "russia" as const, metric: "range" as const, lower: 230000, upper: 270000, seniority: "middle" as const, sample_size: 288, is_fallback: true },
        { source_id: "grades", scope: "market_level" as const, label: "Разработчики", geography: "russia" as const, metric: "range" as const, lower: 370000, upper: 380000, seniority: "senior" as const, sample_size: 209, is_fallback: true },
      ],
      sources: [{
        id: "grades",
        name: "Grades",
        url: "https://example.org/grades",
        methodology_url: "https://example.org/grades",
        period: "2025",
        published_at: "2026-01-01",
        total_sample_size: 552,
        currency: "RUB" as const,
        tax_status: "unknown" as const,
        income_type: "salary" as const,
        methodology_note: "Открытое исследование.",
      }],
    };

    expect(officialSalaryLevelsAreCoherent(official)).toBe(false);
    render(<SalaryBenchmarks data={benchmark} official={official} />);

    expect(screen.queryByText(/перевёрнутую зарплатную градацию/)).not.toBeInTheDocument();
    expect(screen.getByText("100 000 ₽ — 130 000 ₽")).toBeInTheDocument();
    expect(screen.getByText("230 000 ₽ — 270 000 ₽")).toBeInTheDocument();
    expect(screen.getByText("370 000 ₽ — 380 000 ₽")).toBeInTheDocument();
    expect(screen.queryByText("89 300 ₽")).not.toBeInTheDocument();
  });

  it("turns the single Premium header link into active account status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 7,
        email: "premium@example.com",
        display_name: "Premium",
        role: "user",
        access_level: "premium",
      }),
    }));

    render(<PremiumHeaderStatus />);

    expect(screen.getByRole("link", { name: "Premium" })).toHaveAttribute("href", "/pricing");
    expect(await screen.findByRole("link", { name: "Premium активен" })).toHaveAttribute("href", "/account");
  });

  it("keeps the single Premium header link on pricing for a free visitor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<PremiumHeaderStatus />);

    expect(screen.getByRole("link", { name: "Premium" })).toHaveAttribute("href", "/pricing");
  });

  it("pauses and resumes a saved alert without deleting it", async () => {
    document.cookie = "techrole_csrf=csrf-alert";
    const request = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{
          id: 5,
          profession_id: 1,
          profession_slug: "one-c-developer",
          profession_name: "1С-разработчик",
          metric: "salary",
          direction: "up",
          threshold_percent: 5,
          enabled: true,
        }]),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", request);

    render(<AlertsPanel professions={[{
      id: 1,
      slug: "one-c-developer",
      name_ru: "1С-разработчик",
      name_en: "1C Developer",
      description: "Описание",
      category_slug: "development",
      category_name: "Разработка",
      is_premium: false,
      teaser_only: false,
    }]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Поставить правило на паузу" }));

    expect(await screen.findByText("На паузе")).toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(2, "/api/v1/alerts/5", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    }));
    expect(screen.getByRole("link", { name: "1С-разработчик" })).toHaveAttribute("href", "/professions/one-c-developer");
  });

  it("renders a server-safe premium teaser", () => {
    render(<ProfessionCard profession={{ id: 1, slug: "python", name_ru: "Python-разработчик", name_en: "Python Developer", description: "Описание", category_slug: "development", category_name: "Разработка", is_premium: true, teaser_only: true }} />);
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/professions/python");
    expect(screen.getByRole("link")).toHaveClass("after:z-10");
  });

  it("uses accessible trend text and direction", () => {
    render(<TrendBadge label="7 дней" trend={{ period_days: 7, change_percent: 4.2, direction: "up" }} />);
    expect(screen.getByText("7 дней: +4.2%")).toBeInTheDocument();
  });

  it("prepares a mentorship application for the configured email", () => {
    const url = buildMentorshipMailto({
      name: "Иван",
      contact: "@ivan",
      direction: "Backend",
      level: "Junior",
      proposedBudgetRub: 30000,
      context: "Хочу подготовиться к собеседованиям",
    });

    expect(url).toMatch(new RegExp(`^mailto:${MENTORSHIP_EMAIL}\\?`));
    expect(decodeURIComponent(url)).toContain("Заявка на личное ведение - Иван");
    expect(decodeURIComponent(url)).toContain("Предлагаемая стоимость: 30000 ₽");
    expect(decodeURIComponent(url)).toContain("около 20 часов в неделю");
  });

  it("submits mentorship through its own on-site endpoint", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ csrf_token: "mentorship-csrf" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          reference: "mentorship-123",
          status: "queued",
          email_sent: false,
          message: "Заявка отправлена. Я свяжусь с вами по указанному контакту.",
        }),
      });
    vi.stubGlobal("fetch", request);

    render(<MentorshipForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "Имя" }), { target: { value: "Иван" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email или Telegram" }), { target: { value: "ivan@example.com" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Направление" }), { target: { value: "Backend" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Текущий уровень" }), { target: { value: "Junior" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Предлагаемая стоимость, ₽" }), { target: { value: "30000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Что происходит сейчас и к чему хотите прийти" }), { target: { value: "Хочу подготовиться к поиску первой работы Backend-разработчиком." } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Заявка отправлена");
    expect(screen.getByText("Номер: mentorship-123")).toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(1, "/api/v1/mentorship/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(request).toHaveBeenNthCalledWith(2, "/api/v1/mentorship/requests", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "mentorship-csrf" },
      body: JSON.stringify({
        name: "Иван",
        contact: "ivan@example.com",
        direction: "Backend",
        level: "Junior",
        proposed_budget_rub: 30000,
        context: "Хочу подготовиться к поиску первой работы Backend-разработчиком.",
        website: "",
      }),
    }));
  });

  it("switches to the dark theme", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    let initializeTheme: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      initializeTheme = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(<ThemeToggle />);
    const toggle = screen.getByRole("button", { name: "Включить тёмную тему" });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(document.documentElement).not.toHaveClass("dark");

    act(() => initializeTheme?.(0));
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("keeps comparison behind the server-side Premium check", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", request);
    const shared = {
      description: "Описание",
      category_slug: "development",
      category_name: "Разработка",
      is_premium: false,
      teaser_only: false,
    };

    render(<CompareTool professions={[
      { ...shared, id: 1, slug: "frontend", name_ru: "Frontend-разработчик", name_en: "Frontend Developer" },
      { ...shared, id: 2, slug: "backend", name_ru: "Backend-разработчик", name_en: "Backend Developer" },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Сравнить" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Войдите с Premium");
    expect(request).toHaveBeenCalledWith(
      "/api/v1/compare?slugs=frontend%2Cbackend",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("prefers a sourced market benchmark and keeps direction salary as the last fallback", async () => {
    const slices = (values: number[]) => (["junior", "middle", "senior"] as const).map((seniority, index) => ({
      seniority,
      vacancy_count: 10,
      salary_count: 10,
      salary_coverage: 1,
      sample_size: 10,
      median: values[index],
      confidence_level: "medium" as const,
    }));
    const shared = {
      description: "Описание",
      is_premium: false,
      teaser_only: false,
      score: 60,
      official_open_data: {
        source_name: "Работа России",
        source_url: "https://trudvsem.ru/opendata/api",
        period_days: 180,
        date_from: "2026-01-25",
        date_to: "2026-07-23",
        total_publications: 0,
        salary_disclosed_count: 0,
        remote_count: 0,
        confidence_level: "insufficient",
        daily_publications: [],
        category_total_publications: 50,
        category_daily_publications: [],
        category_salary_disclosed_count: 30,
        category_remote_count: 10,
        category_confidence_level: "medium",
        salary_currency: "RUB",
        salary_gross_status: "unknown",
        salary_min_sample: 3,
        salary_by_seniority: slices([]),
        category_salary_by_seniority: slices([120000, 200000, 300000]),
        salary_history: [],
        salary_history_reference_median: 200000,
        salary_history_reference_scope: "category",
        salary_history_minimum_ratio: { junior: 0.4, middle: 0.7, senior: 1 },
        salary_history_minimum_salary: { junior: 80000, middle: 140000, senior: 200000 },
        salary_methodology_note: "Методика",
        methodology_note: "Методика",
      },
    };
    const response = [
      {
        ...shared,
        id: 1,
        slug: "cpp-developer",
        name_ru: "C++ разработчик",
        name_en: "C++ Developer",
        category_slug: "development",
        category_name: "Разработка",
      },
      {
        ...shared,
        id: 2,
        slug: "analytics-engineer",
        name_ru: "Analytics Engineer",
        name_en: "Analytics Engineer",
        category_slug: "data-ai",
        category_name: "Data & AI",
        salary_benchmark: {
          coverage: "category" as const,
          points: [
            { source_id: "market", scope: "market_level" as const, label: "IT-рынок", geography: "russia" as const, metric: "median" as const, value: 114500, seniority: "junior" as const, is_fallback: true },
            { source_id: "market", scope: "market_level" as const, label: "IT-рынок", geography: "russia" as const, metric: "median" as const, value: 200000, seniority: "middle" as const, is_fallback: true },
            { source_id: "market", scope: "market_level" as const, label: "IT-рынок", geography: "russia" as const, metric: "median" as const, value: 310000, seniority: "senior" as const, is_fallback: true },
          ],
          sources: [{
            id: "market",
            name: "Проверяемый зарплатный опрос",
            url: "https://example.com/report",
            methodology_url: "https://example.com/methodology",
            period: "2026",
            published_at: "2026-07-01",
            currency: "RUB" as const,
            tax_status: "net" as const,
            income_type: "salary" as const,
            methodology_note: "Методика",
          }],
          methodology_note: "Методика",
        },
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    }));

    render(<CompareTool professions={response} />);
    fireEvent.click(screen.getByRole("button", { name: "Сравнить" }));

    expect(await screen.findAllByText("120 000 ₽")).toHaveLength(1);
    expect(screen.getAllByText("114 500 ₽")).toHaveLength(1);
    expect(screen.getAllByText("200 000 ₽")).toHaveLength(2);
    expect(screen.getAllByText("300 000 ₽")).toHaveLength(1);
    expect(screen.getAllByText("310 000 ₽")).toHaveLength(1);
    expect(screen.getAllByText("Проверяемый зарплатный опрос")).toHaveLength(3);
    expect(screen.getAllByText("50")).toHaveLength(2);
    expect(screen.getAllByText("20%")).toHaveLength(2);
    expect(screen.queryByText("Недостаточно данных")).not.toBeInTheDocument();
  });

  it("copies a stable profession citation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ShareActions url="https://techrole.ru/professions/backend" title="Backend" citation="TechRole Index. Backend." />);
    fireEvent.click(screen.getByRole("button", { name: "Скопировать цитату" }));
    expect(writeText).toHaveBeenCalledWith("TechRole Index. Backend.");
    expect(await screen.findByText("Цитата скопирована")).toBeInTheDocument();
  });

  it("creates a server-priced test payment without sending an amount", async () => {
    document.cookie = "techrole_csrf=csrf-payment";
    vi.stubGlobal("crypto", { randomUUID: () => "browser-idempotency-0001" });
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        order_id: "order-1",
        product_code: "premium_30_days",
        product_name: "Premium на 30 дней",
        status: "pending",
        amount: "1.00",
        currency: "RUB",
        is_test: true,
      }),
    });
    vi.stubGlobal("fetch", request);
    render(<AccountActions premium={false} payments={{
      enabled: true,
      provider: "demo",
      mode: "test",
      terms_version: "draft-test",
      products: [{
        code: "premium_30_days",
        name: "Premium на 30 дней",
        description: "Доступ",
        amount: "1.00",
        currency: "RUB",
        access_days: 30,
        service_result: "30 дней Premium-доступа",
        fulfillment_code: "premium_entitlement",
        receipt: { name: "Доступ к сервису TechRole Index Premium на 30 дней", payment_method: "full_payment", payment_object: "service", tax: "none" },
        refund_policy_url: "/legal/refunds",
      }],
    }} />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Тестовая оплата/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Создаём защищённый платёж");
    expect(request).toHaveBeenCalledWith("/api/v1/payments", expect.objectContaining({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "browser-idempotency-0001",
        "X-CSRF-Token": "csrf-payment",
      },
      body: JSON.stringify({
        product_code: "premium_30_days",
        accepted_terms: true,
        terms_version: "draft-test",
      }),
    }));
    expect(routerPush).toHaveBeenCalledWith("/payments/pending?order_id=order-1");
  });

  it("submits Robokassa receipt fields with POST to the official payment host", async () => {
    document.cookie = "techrole_csrf=csrf-robokassa";
    vi.stubGlobal("crypto", { randomUUID: () => "browser-idempotency-robo-0001" });
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        order_id: "order-robo-1",
        product_code: "premium_30_days",
        product_name: "Premium на 30 дней",
        status: "pending",
        amount: "290.00",
        currency: "RUB",
        confirmation_url: "https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=techrole&OutSum=290.00&InvId=42&Receipt=%257B%2522items%2522%253A%255B%255D%257D&SignatureValue=signed",
        is_test: false,
      }),
    });
    vi.stubGlobal("fetch", request);
    render(<AccountActions premium={false} payments={{
      enabled: true,
      provider: "robokassa",
      mode: "live",
      terms_version: "offer-2026-07-23",
      products: [{
        code: "premium_30_days",
        name: "Premium на 30 дней",
        description: "Доступ",
        amount: "290.00",
        currency: "RUB",
        access_days: 30,
        service_result: "30 дней Premium-доступа",
        fulfillment_code: "premium_entitlement",
        receipt: { name: "Доступ к сервису TechRole Index Premium на 30 дней", payment_method: "full_payment", payment_object: "service", tax: "none" },
        refund_policy_url: "/legal/refunds",
      }],
    }} />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Оплатить/ }));
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce());

    const form = document.querySelector<HTMLFormElement>("form[action='https://auth.robokassa.ru/Merchant/Index.aspx']");
    expect(form).not.toBeNull();
    expect(form?.method).toBe("post");
    expect(form?.querySelector<HTMLInputElement>("input[name='OutSum']")?.value).toBe("290.00");
    expect(form?.querySelector<HTMLInputElement>("input[name='Receipt']")?.value).toBe("%7B%22items%22%3A%5B%5D%7D");
    expect(form?.action).not.toContain("SignatureValue");
  });

  it("opens the on-site technical support page", () => {
    render(<SupportButton />);
    const link = screen.getByRole("link", { name: "Открыть техподдержку" });
    expect(link).toHaveAttribute("href", "/support");
    expect(link).not.toHaveAttribute("href", expect.stringContaining("mailto:"));
  });

  it("submits a support request through the on-site form", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ csrf_token: "csrf-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          reference: "support-123",
          status: "queued",
          email_sent: false,
          message: "Обращение принято. Ответим на указанный email.",
        }),
      });
    vi.stubGlobal("fetch", request);

    render(<SupportForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "Имя" }), { target: { value: "Иван" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email для ответа" }), { target: { value: "ivan@example.com" } });
    fireEvent.click(screen.getByRole("radio", { name: "Аккаунт и вход Регистрация и доступ" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Краткая тема" }), { target: { value: "Не могу войти" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Что произошло" }), { target: { value: "После ввода данных страница входа не открывает личный кабинет." } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Отправить обращение" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Обращение принято");
    expect(screen.getByText("Номер: support-123")).toBeInTheDocument();
    expect(request).toHaveBeenNthCalledWith(1, "/api/v1/support/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(request).toHaveBeenNthCalledWith(2, "/api/v1/support/requests", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "csrf-token" },
      body: JSON.stringify({
        name: "Иван",
        email: "ivan@example.com",
        topic: "account",
        subject: "Не могу войти",
        message: "После ввода данных страница входа не открывает личный кабинет.",
        website: "",
      }),
    }));
  });

  it("shows a clear support error and keeps the form available", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, json: vi.fn() });
    vi.stubGlobal("fetch", request);

    render(<SupportForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "Имя" }), { target: { value: "Иван" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email для ответа" }), { target: { value: "ivan@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Краткая тема" }), { target: { value: "Ошибка сайта" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Что произошло" }), { target: { value: "При открытии каталога появляется сообщение об ошибке загрузки." } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Отправить обращение" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Не удалось подготовить безопасную отправку");
    expect(screen.getByRole("button", { name: "Отправить обращение" })).toBeEnabled();
  });

  it("offers a keyboard and touch trigger for the career scene", () => {
    render(<CareerTransformationHero />);
    const scene = screen.getByRole("button", { name: "Показать карьерную трансформацию: деньги, деловой образ, сумка для ноутбука и офер" });
    expect(screen.queryByText("Наведите или нажмите")).not.toBeInTheDocument();
    expect(screen.queryByText("Интерактивная карьерная сцена")).not.toBeInTheDocument();
    expect(screen.getByText("Ищу работу")).toBeInTheDocument();
    expect(screen.getByText("Вышел на новую работу")).toBeInTheDocument();
    expect(scene).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(scene);
    expect(scene).toHaveAttribute("aria-pressed", "true");
    expect(scene).toHaveClass("is-active");
  });
});
