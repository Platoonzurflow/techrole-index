"""Replace low-sample roles with high-signal HH professions.

Revision ID: 0012
Revises: 0011
"""

from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


# old slug -> (new slug, ru, en, category, aliases)
REPLACEMENTS: dict[str, tuple[str, str, str, str, tuple[str, ...]]] = {
    "cloud-engineer": (
        "technical-support-specialist",
        "Специалист технической поддержки",
        "Technical Support Specialist",
        "infrastructure",
        (
            "специалист технической поддержки",
            "инженер технической поддержки",
            "technical support specialist",
            "technical support engineer",
            "специалист техподдержки",
            "инженер техподдержки",
            "helpdesk specialist",
            "help desk specialist",
            "service desk specialist",
            "инженер службы технической поддержки",
        ),
    ),
    "sap-developer": (
        "product-manager",
        "Менеджер продукта",
        "Product Manager",
        "analytics",
        (
            "product manager",
            "product owner",
            "менеджер продукта",
            "менеджер по продукту",
            "продакт-менеджер",
            "продакт менеджер",
            "владелец продукта",
        ),
    ),
    "firmware-engineer": (
        "it-project-manager",
        "Руководитель IT-проектов",
        "IT Project Manager",
        "architecture",
        (
            "it project manager",
            "it-project manager",
            "руководитель it проектов",
            "руководитель it-проектов",
            "руководитель ит проектов",
            "руководитель ит-проектов",
            "менеджер it проектов",
            "менеджер it-проектов",
            "менеджер ит проектов",
            "менеджер ит-проектов",
            "руководитель проектов разработки",
            "менеджер проектов разработки",
            "руководитель проектов внедрения информационных систем",
        ),
    ),
    "unreal-engine-developer": (
        "1c-analyst",
        "Аналитик 1С",
        "1C Analyst",
        "analytics",
        (
            "аналитик 1с",
            "аналитик 1c",
            "1с аналитик",
            "1c analyst",
            "консультант-аналитик 1с",
            "аналитик-консультант 1с",
            "программист-аналитик 1с",
            "системный аналитик 1с",
            "бизнес-аналитик 1с",
            "функциональный аналитик 1с",
        ),
    ),
    "javascript-typescript-developer": (
        "qa-engineer",
        "QA-инженер",
        "QA Engineer",
        "quality",
        (
            "qa engineer",
            "qa-инженер",
            "qa инженер",
            "software tester",
            "инженер по тестированию",
            "тестировщик по",
            "тестировщик программного обеспечения",
            "тестировщик мобильных приложений",
            "тестировщик веб-приложений",
            "тестировщик web",
        ),
    ),
    "soc-analyst": (
        "system-engineer",
        "Системный инженер",
        "System Engineer",
        "infrastructure",
        (
            "system engineer",
            "системный инженер",
            "ведущий системный инженер",
            "старший системный инженер",
        ),
    ),
    "analytics-engineer": (
        "ux-ui-designer",
        "UX/UI-дизайнер",
        "UX/UI Designer",
        "specialized",
        (
            "ux/ui designer",
            "ui/ux designer",
            "ux/ui-дизайнер",
            "ui/ux-дизайнер",
            "ux ui дизайнер",
            "ui ux дизайнер",
            "продуктовый дизайнер",
            "product designer",
            "дизайнер интерфейсов",
        ),
    ),
    "nlp-engineer": (
        "ai-engineer",
        "AI-инженер",
        "AI Engineer",
        "data-ai",
        (
            "ai engineer",
            "ai-инженер",
            "ai инженер",
            "ai-разработчик",
            "ai разработчик",
            "инженер ии",
            "инженер искусственного интеллекта",
            "llm engineer",
            "llm-инженер",
            "nlp engineer",
            "nlp инженер",
            "computational linguist",
        ),
    ),
    "postgresql-dba": (
        "erp-specialist",
        "ERP-специалист",
        "ERP Specialist",
        "specialized",
        (
            "erp consultant",
            "erp-консультант",
            "консультант erp",
            "консультант 1с",
            "консультант 1c",
            "1с консультант",
            "1c consultant",
            "sap consultant",
            "консультант sap",
            "sap-консультант",
            "sap developer",
            "sap разработчик",
            "abap developer",
        ),
    ),
    "ruby-developer": (
        "technical-writer",
        "Технический писатель",
        "Technical Writer",
        "specialized",
        (
            "technical writer",
            "технический писатель",
            "старший технический писатель",
            "ведущий технический писатель",
        ),
    ),
}


OLD_PROFESSIONS: dict[str, tuple[str, str, str, tuple[str, ...]]] = {
    "cloud-engineer": ("Облачный инженер", "Cloud Engineer", "infrastructure", ("cloud engineer", "cloud-инженер", "облачный инженер", "инженер облачной инфраструктуры", "cloud infrastructure engineer")),
    "sap-developer": ("SAP-разработчик", "SAP Developer", "specialized", ("sap developer", "sap разработчик", "abap developer")),
    "firmware-engineer": ("Firmware-инженер", "Firmware Engineer", "specialized", ("firmware engineer", "firmware developer", "разработчик микропрограмм")),
    "unreal-engine-developer": ("Unreal Engine-разработчик", "Unreal Engine Developer", "specialized", ("unreal engine developer", "unreal developer", "ue developer")),
    "javascript-typescript-developer": ("JavaScript/TypeScript-разработчик", "JavaScript/TypeScript Developer", "development", ("javascript developer", "typescript developer", "js developer", "typescript разработчик")),
    "soc-analyst": ("SOC-аналитик", "SOC Analyst", "security", ("soc analyst", "soc аналитик", "аналитик центра мониторинга", "специалист первой линии отдела soc", "инженер центра мониторинга информационной безопасности")),
    "analytics-engineer": ("Analytics Engineer", "Analytics Engineer", "data-ai", ("analytics engineer", "аналитический инженер", "dbt developer")),
    "nlp-engineer": ("NLP-инженер", "NLP Engineer", "data-ai", ("nlp engineer", "nlp инженер", "computational linguist")),
    "postgresql-dba": ("Администратор PostgreSQL", "PostgreSQL DBA", "data-ai", ("postgresql dba", "postgres dba", "администратор postgresql")),
    "ruby-developer": ("Ruby-разработчик", "Ruby Developer", "development", ("ruby developer", "ruby разработчик", "rails developer")),
}


def _description(name_ru: str, name_en: str, category: str) -> str:
    focus = {
        "development": "проектирует и развивает программные продукты",
        "quality": "повышает качество и предсказуемость выпуска программных систем",
        "infrastructure": "обеспечивает устойчивость, автоматизацию и эксплуатацию платформ",
        "analytics": "превращает данные и требования в проверяемые продуктовые решения",
        "data-ai": "строит данные, модели и аналитические контуры для принятия решений",
        "security": "снижает технологические риски и защищает информационные системы",
        "specialized": "создаёт специализированные программно-аппаратные решения",
        "architecture": "согласует бизнес-цели с архитектурой и ограничениями систем",
    }[category]
    return f"{name_ru} ({name_en}) {focus}. Индекс показывает спрос, зарплаты и динамику по уровням с явной оценкой достоверности."


def _replace(old_slug: str, new_slug: str, name_ru: str, name_en: str, category: str, aliases: tuple[str, ...]) -> None:
    bind = op.get_bind()
    now = datetime.now(timezone.utc)
    profession_id = bind.execute(
        sa.text("SELECT id FROM professions WHERE slug = :slug"), {"slug": old_slug}
    ).scalar_one_or_none()
    if profession_id is None:
        return
    category_id = bind.execute(
        sa.text("SELECT id FROM profession_categories WHERE slug = :slug"),
        {"slug": category},
    ).scalar_one()
    bind.execute(
        sa.text(
            "UPDATE professions SET slug=:new_slug, name_ru=:name_ru, name_en=:name_en, "
            "description=:description, category_id=:category_id, updated_at=:updated_at "
            "WHERE id=:profession_id"
        ),
        {
            "new_slug": new_slug,
            "name_ru": name_ru,
            "name_en": name_en,
            "description": _description(name_ru, name_en, category),
            "category_id": category_id,
            "updated_at": now,
            "profession_id": profession_id,
        },
    )
    bind.execute(
        sa.text("DELETE FROM profession_aliases WHERE profession_id=:profession_id"),
        {"profession_id": profession_id},
    )
    for alias in aliases:
        bind.execute(
            sa.text(
                "INSERT INTO profession_aliases "
                "(profession_id, alias, is_regex, exclude_pattern, created_at, updated_at) "
                "VALUES (:profession_id, :alias, false, null, :now, :now)"
            ),
            {"profession_id": profession_id, "alias": alias, "now": now},
        )


def upgrade() -> None:
    for old_slug, replacement in REPLACEMENTS.items():
        _replace(old_slug, *replacement)

    # The taxonomy changed for both replacement roles and merged aliases.
    # Reclassification plus a full materialization repopulates these rows.
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM observed_publication_metrics_daily "
            "WHERE source_id=(SELECT id FROM vacancy_sources WHERE code='hh_api')"
        )
    )


def downgrade() -> None:
    reverse = {replacement[0]: old_slug for old_slug, replacement in REPLACEMENTS.items()}
    for new_slug, old_slug in reverse.items():
        name_ru, name_en, category, aliases = OLD_PROFESSIONS[old_slug]
        _replace(new_slug, old_slug, name_ru, name_en, category, aliases)
