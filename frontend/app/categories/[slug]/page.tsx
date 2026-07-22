import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfessionCard } from "@/components/ProfessionCard";
import { safeApi } from "@/lib/api";
import { categoryMetadataFor } from "@/lib/category-metadata";
import type { ProfessionSummary } from "@/lib/types";

interface Category { slug: string; name: string; description: string; profession_count: number }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryMetadataFor(slug);
  return { title: category.name, description: category.description, alternates: { canonical: `/categories/${slug}` } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, professions] = await Promise.all([safeApi<Category[]>("/categories", []), safeApi<ProfessionSummary[]>(`/professions?category=${encodeURIComponent(slug)}`, [])]);
  const category = categories.find((item) => item.slug === slug);
  const fallback = categoryMetadataFor(slug);
  if (!category && categories.length) notFound();
  return <div className="shell py-12"><p className="eyebrow">Категория</p><h1 className="mt-3 text-4xl font-bold">{category?.name ?? fallback.name}</h1><p className="mt-4 max-w-3xl text-lg text-muted">{category?.description ?? fallback.description}</p><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{professions.map((item) => <ProfessionCard key={item.slug} profession={item} />)}</div></div>;
}
