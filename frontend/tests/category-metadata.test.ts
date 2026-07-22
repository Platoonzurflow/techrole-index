import { describe, expect, it } from "vitest";
import { categoryMetadata, categoryMetadataFor } from "@/lib/category-metadata";

describe("category metadata", () => {
  it("keeps every catalog category independently renderable", () => {
    expect(Object.keys(categoryMetadata)).toHaveLength(8);
    for (const [slug, metadata] of Object.entries(categoryMetadata)) {
      expect(slug).not.toBe("");
      expect(metadata.name).not.toBe("");
      expect(metadata.description).not.toBe("");
    }
    expect(categoryMetadataFor("specialized")).toEqual({
      name: "Специализированная разработка",
      description: "Игры, embedded и корпоративные платформы.",
    });
  });

  it("returns unique non-empty metadata during an API outage", () => {
    expect(categoryMetadataFor("temporary-role")).toEqual({
      name: "Категория temporary-role",
      description: (
        "IT-профессии категории temporary-role: зарплаты, спрос и уровень достоверности данных."
      ),
    });
  });
});
