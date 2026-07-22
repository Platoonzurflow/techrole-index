import { Search } from "lucide-react";

interface Suggestion {
  slug: string;
  name_ru: string;
  name_en?: string | null;
}

interface CategoryOption {
  slug: string;
  name: string;
}

export function ProfessionSearch({
  suggestions = [],
  initialQuery,
  initialCategory,
  categories = [],
  compact = false,
}: {
  suggestions?: Suggestion[];
  initialQuery?: string;
  initialCategory?: string;
  categories?: CategoryOption[];
  compact?: boolean;
}) {
  return (
    <form className={`career-search ${compact ? "profession-search-compact" : ""}`} action="/professions" method="get" role="search">
      <Search size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor={compact ? "profession-query" : "career-query"}>Название профессии</label>
      <input
        id={compact ? "profession-query" : "career-query"}
        name="query"
        type="search"
        placeholder="Например: Python-разработчик"
        defaultValue={initialQuery}
        maxLength={120}
        list="profession-suggestions"
        autoComplete="off"
      />
      <datalist id="profession-suggestions">
        {suggestions.flatMap((item) => [
          <option key={`${item.slug}-ru`} value={item.name_ru} />,
          ...(item.name_en ? [<option key={`${item.slug}-en`} value={item.name_en} />] : []),
        ])}
      </datalist>
      {categories.length ? (
        <label className="sr-only" htmlFor="profession-category">Направление</label>
      ) : null}
      {categories.length ? (
        <select id="profession-category" name="category" defaultValue={initialCategory ?? ""} aria-label="Направление">
          <option value="">Все направления</option>
          {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
        </select>
      ) : null}
      <button type="submit">Найти профессию</button>
    </form>
  );
}
