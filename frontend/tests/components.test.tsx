import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
import { SalaryBenchmarks } from "@/components/SalaryBenchmarks";
import { AdminPanel } from "@/components/AdminPanel";
import { ProfessionSearch } from "@/components/ProfessionSearch";
import { ShareActions } from "@/components/ShareActions";

const { routerPush, routerRefresh } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.className = "";
  routerPush.mockReset();
  routerRefresh.mockReset();
});

describe("analytics components", () => {
  it("keeps search suggestions and category filter in one GET form", () => {
    render(<ProfessionSearch compact initialQuery="Data" initialCategory="data-ai" suggestions={[{ slug: "data-engineer", name_ru: "Инженер по данным", name_en: "Data Engineer" }]} categories={[{ slug: "data-ai", name: "Data & AI" }]} />);

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/professions");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByDisplayValue("Data")).toHaveAttribute("name", "query");
    expect(screen.getByDisplayValue("Data & AI")).toHaveAttribute("name", "category");
    expect(screen.getByDisplayValue("Data & AI").closest(".app-select-shell")).not.toBeNull();
    const suggestionValues = Array.from(document.querySelectorAll("datalist option")).map((option) => option.getAttribute("value"));
    expect(suggestionValues).toEqual(expect.arrayContaining(["Инженер по данным", "Data Engineer"]));
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
      salary_min_sample: 20,
      salary_by_seniority: (["junior", "middle", "senior"] as const).map((seniority) => ({
        seniority,
        vacancy_count: 1,
        salary_count: 1,
        salary_coverage: 1,
        sample_size: 1,
        confidence_level: "insufficient" as const,
      })),
      salary_history: [],
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
