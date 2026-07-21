import type { Metadata } from "next";
import { Clock3, LifeBuoy, LockKeyhole, MailCheck } from "lucide-react";
import { SupportForm } from "@/components/SupportForm";

export const metadata: Metadata = {
  title: "Техподдержка",
  description: "Свяжитесь с техподдержкой TechRole Index прямо на сайте.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <div className="shell py-12 lg:py-16">
      <section className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <p className="eyebrow flex items-center gap-2"><LifeBuoy size={15} /> Техподдержка</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">Расскажите, что не работает</h1>
          <p className="mt-6 text-lg leading-8 text-muted">Сообщение отправляется внутри сайта. Укажите email для ответа и опишите проблему как можно точнее.</p>
          <div className="mt-8 grid gap-3">
            <div className="flex gap-3 rounded-xl border border-line bg-panel p-4"><MailCheck className="shrink-0 text-positive" size={20} /><div><strong>Ответ на ваш email</strong><p className="mt-1 text-sm text-muted">Номер обращения появится сразу после отправки.</p></div></div>
            <div className="flex gap-3 rounded-xl border border-line bg-panel p-4"><LockKeyhole className="shrink-0 text-accent" size={20} /><div><strong>Без паролей</strong><p className="mt-1 text-sm text-muted">Никогда не отправляйте пароль, код подтверждения или банковские данные.</p></div></div>
            <div className="flex gap-3 rounded-xl border border-line bg-panel p-4"><Clock3 className="shrink-0 text-muted" size={20} /><div><strong>Статус сохраняется</strong><p className="mt-1 text-sm text-muted">Если почта временно недоступна, обращение не потеряется.</p></div></div>
          </div>
        </div>
        <SupportForm />
      </section>
    </div>
  );
}
