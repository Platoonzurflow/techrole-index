import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Тарифы",
  description: "Бесплатный и Premium-доступ к аналитике IT-профессий.",
  alternates: { canonical: "/pricing" },
};

const free = [
  "Каталог 50 профессий",
  "Базовые метрики для 70% ролей",
  "Графики за последние 30 дней",
  "Публичный top-3",
];

const premium = [
  "Детали всех профессий",
  "Полный рейтинг",
  "Графики примерно за 6 месяцев",
  "Сравнение 2-3 профессий",
  "Premium-дашборд",
  "CSV-экспорт и уведомления",
];

export default function PricingPage() {
  return (
    <div className="shell py-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Прозрачные тарифы</p>
        <h1 className="mt-3 text-4xl font-bold">Начните бесплатно, углубляйтесь с Premium</h1>
        <p className="mt-4 text-lg text-muted">Платёжный провайдер пока не подключён. Активация Premium не списывает деньги и не запрашивает платёжные данные.</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <article className="panel p-7">
          <p className="eyebrow">Free</p>
          <h2 className="mt-3 text-3xl font-semibold">0 ₽</h2>
          <p className="mt-2 text-muted">Для знакомства с рынком</p>
          <ul className="mt-7 grid gap-3">{free.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 shrink-0 text-positive" size={17} />{item}</li>)}</ul>
          <Link href="/register" className="button-secondary mt-8 w-full">Создать аккаунт</Link>
        </article>
        <article className="panel border-amber-400/40 p-7">
          <p className="eyebrow text-amber-600">Premium</p>
          <h2 className="mt-3 text-3xl font-semibold">Доступ на 30 дней</h2>
          <p className="mt-2 text-muted">Активация доступна в личном кабинете</p>
          <ul className="mt-7 grid gap-3">{premium.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 shrink-0 text-positive" size={17} />{item}</li>)}</ul>
          <Link href="/account" className="button-primary mt-8 w-full">Открыть личный кабинет</Link>
        </article>
      </div>
    </div>
  );
}
