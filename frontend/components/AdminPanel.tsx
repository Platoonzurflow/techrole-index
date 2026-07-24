"use client";

import { useEffect, useMemo, useState } from "react";
import { browserCsrf } from "@/lib/browser";

interface AdminProfession {
  id: number;
  slug: string;
  name_ru: string;
  name_en: string;
  is_premium: boolean;
  is_active: boolean;
}

interface PaymentReadinessCheck {
  code: string;
  label: string;
  ready: boolean;
}

interface PaymentReadiness {
  provider: "demo" | "yookassa" | "robokassa";
  mode: "test" | "live";
  payments_enabled: boolean;
  test_ready: boolean;
  live_ready: boolean;
  test_checks: PaymentReadinessCheck[];
  live_checks: PaymentReadinessCheck[];
  result_url?: string;
}

interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_blocked: boolean;
  access_level: "free" | "premium";
  premium_expires_at?: string | null;
  admin_grant_active: boolean;
  paid_premium_active: boolean;
}

function formatAccessEnd(value?: string | null) {
  if (!value) return "без ограничения";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
}

function ReadinessList({ checks }: { checks: PaymentReadinessCheck[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {checks.map((check) => (
        <li className="flex gap-2" key={check.code}>
          <span aria-hidden="true" className={check.ready ? "text-emerald-600" : "text-amber-600"}>
            {check.ready ? "✓" : "○"}
          </span>
          <span>{check.label}</span>
        </li>
      ))}
    </ul>
  );
}

function PaymentReadinessCard({ data }: { data: PaymentReadiness }) {
  return (
    <section className="panel mt-8 p-6" aria-labelledby="payment-readiness-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Платежи</p>
          <h2 id="payment-readiness-title" className="mt-2 text-2xl font-bold">
            Готовность Robokassa
          </h2>
          <p className="mt-2 text-sm text-muted">
            Здесь показаны только признаки настройки. Пароли и ключи API не передаются в браузер.
          </p>
        </div>
        <span className={`badge ${data.live_ready ? "confidence-high" : "confidence-low"}`}>
          {data.live_ready ? "Готово к запуску" : "Реальные списания заблокированы"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] p-5">
          <h3 className="font-bold">Тестовый магазин</h3>
          <p className="mt-1 text-sm text-muted">
            {data.test_ready ? "Можно проводить тестовый сценарий." : "Нужно закрыть отмеченные пункты."}
          </p>
          <ReadinessList checks={data.test_checks} />
        </div>
        <div className="rounded-2xl border border-[var(--line)] p-5">
          <h3 className="font-bold">Реальные платежи</h3>
          <p className="mt-1 text-sm text-muted">
            {data.live_ready ? "Все программные блокировки сняты." : "Боевой режим остаётся выключенным."}
          </p>
          <ReadinessList checks={data.live_checks} />
        </div>
      </div>

      {data.result_url ? (
        <div className="mt-4 rounded-2xl border border-[var(--line)] p-4 text-sm">
          <span className="font-semibold">ResultURL: </span>
          <code className="break-all">{data.result_url}</code>
        </div>
      ) : null}
    </section>
  );
}

export function AdminPanel() {
  const [items, setItems] = useState<AdminProfession[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [readiness, setReadiness] = useState<PaymentReadiness | null>(null);
  const [message, setMessage] = useState("Загрузка…");
  const [usersMessage, setUsersMessage] = useState("Загрузка пользователей…");
  const [userQuery, setUserQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/admin/professions", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setMessage(
            response.status === 401 || response.status === 403
              ? "Войдите под администратором."
              : "Не удалось загрузить данные.",
          );
          return;
        }
        setItems(await response.json());
        setMessage("");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setMessage("Не удалось загрузить данные.");
        }
      });
    fetch("/api/v1/admin/payment-readiness", { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setReadiness(await response.json());
      })
      .catch(() => undefined);
    fetch("/api/v1/admin/users", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setUsersMessage("Не удалось загрузить пользователей.");
          return;
        }
        setUsers(await response.json());
        setUsersMessage("");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setUsersMessage("Не удалось загрузить пользователей.");
        }
      });
    return () => controller.abort();
  }, []);

  const visibleUsers = useMemo(() => {
    const query = userQuery.trim().toLocaleLowerCase("ru-RU");
    if (!query) return users;
    return users.filter((user) =>
      `${user.email} ${user.display_name} ${user.id}`.toLocaleLowerCase("ru-RU").includes(query),
    );
  }, [userQuery, users]);

  const toggle = async (item: AdminProfession, field: "is_premium" | "is_active") => {
    const response = await fetch(`/api/v1/admin/professions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() },
      body: JSON.stringify({ [field]: !item[field] }),
    });
    if (!response.ok) {
      setMessage("Изменение отклонено сервером.");
      return;
    }
    setItems(
      items.map((current) =>
        current.id === item.id ? { ...current, [field]: !item[field] } : current,
      ),
    );
  };

  const recalculate = async () => {
    const response = await fetch("/api/v1/admin/recalculate", {
      method: "POST",
      headers: { "X-CSRF-Token": browserCsrf() },
    });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Задача поставлена: ${payload.task_id}` : "Не удалось запустить расчёт.");
  };

  const setAccess = async (user: AdminUser) => {
    const accessLevel = user.admin_grant_active ? "free" : "premium";
    setUpdatingUserId(user.id);
    setUsersMessage("");
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": browserCsrf() },
        body: JSON.stringify({ access_level: accessLevel }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUsersMessage(payload.detail ?? "Изменение доступа отклонено сервером.");
        return;
      }
      setUsers((current) => current.map((item) => item.id === user.id ? payload : item));
      setUsersMessage(
        accessLevel === "premium"
          ? `Premium включён для ${user.email}.`
          : user.paid_premium_active
            ? `Ручная выдача снята; оплаченный Premium ${user.email} сохранён.`
            : `Для ${user.email} включён режим Free.`,
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!items.length) {
    return (
      <div className="panel mt-8 p-8 text-muted" role="status">
        {message}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" className="button-primary" onClick={recalculate}>
          Запустить перерасчёт
        </button>
        <a href="/api/v1/admin/ingestion-runs" className="button-secondary">
          Ingestion runs JSON
        </a>
        <a href="/api/v1/admin/vacancies/uncertain" className="button-secondary">
          Неопределённые вакансии
        </a>
        {message ? (
          <span className="text-sm text-muted" role="status">
            {message}
          </span>
        ) : null}
      </div>
      {readiness ? <PaymentReadinessCard data={readiness} /> : null}
      <section className="panel mt-8 p-6" aria-labelledby="user-access-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Доступ пользователей</p>
            <h2 id="user-access-title" className="mt-2 text-2xl font-bold">
              Режим Free / Premium
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Ручной Premium действует до отключения. Переключение в Free снимает только
              административную выдачу и не отменяет оплаченный период.
            </p>
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            Найти пользователя
            <input
              type="search"
              className="field min-w-64"
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Email, имя или ID"
            />
          </label>
        </div>
        {usersMessage ? (
          <p className="mt-4 text-sm text-muted" role="status">{usersMessage}</p>
        ) : null}
        <div className="table-wrap mt-6">
          <table className="data-table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Доступ</th>
                <th>Источник</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => {
                const isAdmin = user.role === "admin";
                const paidOnly = user.paid_premium_active && !user.admin_grant_active;
                return (
                  <tr key={user.id}>
                    <td>
                      <span className="font-semibold">{user.display_name}</span>
                      <span className="block text-sm text-muted">{user.email} · ID {user.id}</span>
                    </td>
                    <td>
                      <span className={`badge ${user.access_level === "premium" ? "badge-premium" : ""}`}>
                        {user.access_level === "premium" ? "Premium" : "Free"}
                      </span>
                      {user.access_level === "premium" && !isAdmin ? (
                        <span className="mt-1 block text-xs text-muted">
                          {formatAccessEnd(user.premium_expires_at)}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-sm text-muted">
                      {isAdmin
                        ? "роль администратора"
                        : user.admin_grant_active && user.paid_premium_active
                          ? "ручной + оплаченный"
                          : user.admin_grant_active
                            ? "ручной"
                            : user.paid_premium_active
                              ? "оплаченный"
                              : "нет"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${user.admin_grant_active ? "button-secondary" : "button-primary"} disabled:cursor-not-allowed disabled:opacity-50`}
                        disabled={isAdmin || paidOnly || updatingUserId === user.id}
                        onClick={() => setAccess(user)}
                      >
                        {updatingUserId === user.id
                          ? "Сохраняю…"
                          : isAdmin
                            ? "Всегда Premium"
                            : paidOnly
                              ? "Оплачен"
                              : user.admin_grant_active
                                ? "Сделать Free"
                                : "Включить Premium"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visibleUsers.length && !usersMessage ? (
                <tr><td colSpan={4} className="text-muted">Пользователи не найдены.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <div className="table-wrap mt-8">
        <table className="data-table">
          <thead>
            <tr>
              <th>Профессия</th>
              <th>Slug</th>
              <th>Premium</th>
              <th>Активна</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="font-semibold">
                  {item.name_ru}
                  <div className="text-sm font-normal text-muted">{item.name_en}</div>
                </td>
                <td className="font-mono text-sm">{item.slug}</td>
                <td>
                  <button
                    type="button"
                    className={`badge ${item.is_premium ? "badge-premium" : ""}`}
                    onClick={() => toggle(item, "is_premium")}
                  >
                    {item.is_premium ? "Premium" : "Public"}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={`badge ${item.is_active ? "confidence-high" : "confidence-low"}`}
                    onClick={() => toggle(item, "is_active")}
                  >
                    {item.is_active ? "Да" : "Нет"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
