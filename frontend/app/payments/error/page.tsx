import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Оплата не завершена", robots: { index: false, follow: false } };

export default function PaymentErrorPage() {
  return (
    <div className="shell py-20 text-center">
      <p className="eyebrow">Оплата не завершена</p>
      <h1 className="mt-3 text-4xl font-bold">Premium не активирован</h1>
      <p className="mx-auto mt-4 max-w-2xl text-muted">Платёж отменён или не подтверждён. Повторная попытка создаст новый заказ; статус и сумма никогда не принимаются от браузера.</p>
      <div className="mt-7 flex justify-center gap-3"><Link href="/account" className="button-primary">Вернуться в кабинет</Link><Link href="/support" className="button-secondary">Написать в поддержку</Link></div>
    </div>
  );
}
