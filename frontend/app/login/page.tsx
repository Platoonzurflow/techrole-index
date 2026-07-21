import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
export const metadata: Metadata = { title: "Вход", robots: { index: false } };
export default function LoginPage() { return <div className="shell py-14"><div className="text-center"><p className="eyebrow">Аккаунт</p><h1 className="mt-3 text-4xl font-bold">Вход в TechRole Index</h1><p className="mt-3 text-muted">Сессия хранится в защищённой HttpOnly cookie.</p></div><AuthForm mode="login" /></div>; }

