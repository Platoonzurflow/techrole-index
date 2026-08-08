"""Replace sparse HH roles with salary-rich digital professions.

Revision ID: 0014
Revises: 0013
"""

from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


ProfessionSpec = tuple[str, str, str, str, tuple[str, ...]]


REPLACEMENTS: dict[str, ProfessionSpec] = {
    "android-developer": (
        "mobile-developer",
        "Мобильный разработчик",
        "Mobile Developer",
        "development",
        (
            "mobile developer", "mobile application developer", "мобильный разработчик",
            "разработчик мобильных приложений", "android developer", "android разработчик",
            "kotlin android", "ios developer", "ios разработчик", "swift developer",
            "flutter developer", "flutter разработчик", "dart developer",
            "react native developer", "react native разработчик",
        ),
    ),
    "ios-developer": (
        "information-systems-administrator",
        "Администратор информационных систем",
        "Information Systems Administrator",
        "infrastructure",
        (
            "администратор информационных систем", "information systems administrator",
            "администратор ис", "администратор корпоративных систем",
        ),
    ),
    "flutter-developer": (
        "it-sales-manager",
        "Менеджер по продажам IT-решений",
        "IT Sales Manager",
        "specialized",
        (
            "менеджер по продажам it", "it sales manager",
            "менеджер по продажам программного обеспечения", "менеджер по продажам saas",
            "менеджер по продажам it-решений", "менеджер по продажам информационных систем",
        ),
    ),
    "react-native-developer": (
        "automation-specialist",
        "Специалист по автоматизации",
        "Automation Specialist",
        "specialized",
        (
            "специалист по автоматизации", "инженер по автоматизации",
            "специалист по автоматизации бизнес-процессов", "rpa developer", "rpa-разработчик",
        ),
    ),
    "sdet": (
        "implementation-specialist",
        "Специалист по внедрению",
        "Implementation Specialist",
        "specialized",
        (
            "специалист по внедрению", "инженер по внедрению", "консультант по внедрению",
            "implementation specialist", "implementation engineer",
        ),
    ),
    "sre": (
        "web-designer",
        "Веб-дизайнер",
        "Web Designer",
        "specialized",
        ("веб-дизайнер", "web-дизайнер", "web designer", "дизайнер сайтов"),
    ),
    "platform-engineer": (
        "seo-specialist",
        "SEO-специалист",
        "SEO Specialist",
        "specialized",
        ("seo-специалист", "seo специалист", "seo specialist", "seo-оптимизатор"),
    ),
    "mlops-engineer": (
        "internet-marketer",
        "Интернет-маркетолог",
        "Digital Marketing Specialist",
        "specialized",
        ("интернет-маркетолог", "digital-маркетолог", "digital marketer", "маркетолог digital"),
    ),
    "penetration-tester": (
        "database-operator",
        "Оператор баз данных",
        "Database Operator",
        "data-ai",
        ("оператор базы данных", "оператор бд", "database operator", "специалист по ведению базы данных"),
    ),
    "unity-developer": (
        "development-manager",
        "Руководитель разработки",
        "Development Manager",
        "architecture",
        (
            "руководитель отдела разработки", "руководитель разработки", "head of development",
            "development manager", "директор по разработке по", "руководитель группы разработки",
        ),
    ),
}


OLD_PROFESSIONS: dict[str, ProfessionSpec] = {
    "mobile-developer": ("android-developer", "Android-разработчик", "Android Developer", "development", ("android developer", "android разработчик", "kotlin android")),
    "information-systems-administrator": ("ios-developer", "iOS-разработчик", "iOS Developer", "development", ("ios developer", "ios разработчик", "swift developer")),
    "it-sales-manager": ("flutter-developer", "Flutter-разработчик", "Flutter Developer", "development", ("flutter developer", "flutter разработчик", "dart developer")),
    "automation-specialist": ("react-native-developer", "React Native-разработчик", "React Native Developer", "development", ("react native developer", "react native разработчик")),
    "implementation-specialist": ("sdet", "SDET-инженер", "SDET", "quality", ("sdet", "software development engineer in test")),
    "web-designer": ("sre", "Site Reliability Engineer", "SRE", "infrastructure", ("site reliability engineer", "sre engineer", "sre инженер")),
    "seo-specialist": ("platform-engineer", "Platform-инженер", "Platform Engineer", "infrastructure", ("platform engineer", "platform инженер", "инженер платформы")),
    "internet-marketer": ("mlops-engineer", "MLOps-инженер", "MLOps Engineer", "data-ai", ("mlops engineer", "mlops инженер")),
    "database-operator": ("penetration-tester", "Специалист по тестированию на проникновение", "Penetration Tester", "security", ("penetration tester", "pentester", "пентестер")),
    "development-manager": ("unity-developer", "Unity-разработчик", "Unity Developer", "specialized", ("unity developer", "unity разработчик")),
}


def _description(name_ru: str, name_en: str, category: str) -> str:
    focus = {
        "development": "проектирует и развивает программные продукты",
        "quality": "повышает качество и предсказуемость выпуска программных систем",
        "infrastructure": "обеспечивает устойчивость, автоматизацию и эксплуатацию платформ",
        "analytics": "превращает данные и требования в проверяемые продуктовые решения",
        "data-ai": "строит данные, модели и аналитические контуры для принятия решений",
        "security": "снижает технологические риски и защищает информационные системы",
        "specialized": "связывает цифровой продукт, данные и бизнес-процессы",
        "architecture": "согласует бизнес-цели с архитектурой и ограничениями систем",
    }[category]
    return f"{name_ru} ({name_en}) {focus}. Индекс показывает спрос, зарплаты и динамику по уровням с явной оценкой достоверности."


def _replace(old_slug: str, spec: ProfessionSpec, *, clear_metrics: bool) -> None:
    new_slug, name_ru, name_en, category, aliases = spec
    bind = op.get_bind()
    now = datetime.now(timezone.utc)
    profession_id = bind.execute(
        sa.text("SELECT id FROM professions WHERE slug=:slug"), {"slug": old_slug}
    ).scalar_one_or_none()
    if profession_id is None:
        return
    if clear_metrics:
        bind.execute(
            sa.text("UPDATE vacancies SET profession_id=null WHERE profession_id=:profession_id"),
            {"profession_id": profession_id},
        )
        bind.execute(
            sa.text("UPDATE notification_rules SET enabled=false WHERE profession_id=:profession_id"),
            {"profession_id": profession_id},
        )
        for table in (
            "vacancy_profession_matches",
            "profession_metrics_daily",
            "profession_scores_daily",
            "observed_publication_metrics_daily",
            "source_queries",
        ):
            bind.execute(
                sa.text(f"DELETE FROM {table} WHERE profession_id=:profession_id"),
                {"profession_id": profession_id},
            )
    category_id = bind.execute(
        sa.text("SELECT id FROM profession_categories WHERE slug=:slug"),
        {"slug": category},
    ).scalar_one()
    bind.execute(
        sa.text(
            "UPDATE professions SET slug=:slug,name_ru=:name_ru,name_en=:name_en,"
            "description=:description,category_id=:category_id,updated_at=:now WHERE id=:id"
        ),
        {
            "slug": new_slug,
            "name_ru": name_ru,
            "name_en": name_en,
            "description": _description(name_ru, name_en, category),
            "category_id": category_id,
            "now": now,
            "id": profession_id,
        },
    )
    bind.execute(
        sa.text("DELETE FROM profession_aliases WHERE profession_id=:id"),
        {"id": profession_id},
    )
    for alias in aliases:
        bind.execute(
            sa.text(
                "INSERT INTO profession_aliases "
                "(profession_id,alias,is_regex,exclude_pattern,created_at,updated_at) "
                "VALUES (:id,:alias,false,null,:now,:now)"
            ),
            {"id": profession_id, "alias": alias, "now": now},
        )


def upgrade() -> None:
    for old_slug, spec in REPLACEMENTS.items():
        _replace(old_slug, spec, clear_metrics=True)


def downgrade() -> None:
    for new_slug, spec in OLD_PROFESSIONS.items():
        _replace(new_slug, spec, clear_metrics=True)
