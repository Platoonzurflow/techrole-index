import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
export const metadata: Metadata = { title: "Регистрация", robots: { index: false } };
export default function RegisterPage() { return <div className="shell py-14"><div className="text-center"><p className="eyebrow">Бесплатный доступ</p><h1 className="mt-3 text-4xl font-bold">Создать аккаунт</h1><p className="mt-3 text-muted">Начните с каталога и 30-дневной истории без оплаты.</p></div><AuthForm mode="register" /></div>; }

