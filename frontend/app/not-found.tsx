import Link from "next/link";
export default function NotFound() { return <div className="shell py-24 text-center"><p className="font-mono text-7xl font-bold text-accent">404</p><h1 className="mt-5 text-3xl font-semibold">Страница не найдена</h1><p className="mt-3 text-muted">Возможно, адрес изменился или профессия отключена.</p><Link href="/professions" className="button-primary mt-7">В каталог</Link></div>; }

