export default function Loading() {
  return <div className="shell py-14" aria-label="Загрузка"><div className="skeleton h-5 w-32" /><div className="skeleton mt-4 h-12 max-w-2xl" /><div className="mt-10 grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-56" />)}</div></div>;
}

