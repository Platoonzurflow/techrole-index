export interface CategoryMetadata {
  name: string;
  description: string;
}

export const categoryMetadata: Record<string, CategoryMetadata> = {
  development: {
    name: "Разработка",
    description: "Прикладная, мобильная и корпоративная разработка.",
  },
  quality: {
    name: "Тестирование",
    description: "Контроль качества и автоматизация тестирования.",
  },
  infrastructure: {
    name: "Инфраструктура",
    description: "Эксплуатация, облака и надёжность платформ.",
  },
  analytics: {
    name: "Аналитика",
    description: "Анализ данных, продуктов и бизнес-процессов.",
  },
  "data-ai": {
    name: "Data & AI",
    description: "Инженерия данных, машинное обучение и AI.",
  },
  security: {
    name: "Информационная безопасность",
    description: "Защита систем, мониторинг и аудит.",
  },
  specialized: {
    name: "Специализированная разработка",
    description: "Игры, embedded и корпоративные платформы.",
  },
  architecture: {
    name: "Архитектура",
    description: "Проектирование технологических решений.",
  },
};

export function categoryMetadataFor(slug: string): CategoryMetadata {
  return categoryMetadata[slug] ?? {
    name: `Категория ${slug}`,
    description: `IT-профессии категории ${slug}: зарплаты, спрос и уровень достоверности данных.`,
  };
}
