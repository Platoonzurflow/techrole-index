"""Versioned public salary benchmarks with explicit provenance.

These values are not mixed with vacancy salary observations.  They are a
separate reference layer built from public reports about actual compensation.
"""

from __future__ import annotations

from typing import Any, TypedDict


class SalarySource(TypedDict):
    id: str
    name: str
    url: str
    methodology_url: str
    period: str
    published_at: str
    total_sample_size: int | None
    currency: str
    tax_status: str
    income_type: str
    methodology_note: str


SeniorityPoint = tuple[
    str,
    str,
    int,
    int | None,
    int | None,
    int | None,
    str,
    str,
    str,
    str | None,
]


# profession slug -> Habr Career specialization alias, public label, SEO median.
# Only the median deliberately exposed in the public page title/description is
# retained. Values hidden behind account access are not extracted.
HABR_CALCULATOR_PUBLIC_MEDIANS = {
    "qa-manual": ("manual_testing", "Инженер по ручному тестированию", 132500),
    "data-scientist": ("data_scientist", "Ученый по данным", 235541),
    "mlops-engineer": ("mlops", "MLOps-инженер", 351666),
    "computer-vision-engineer": (
        "cv_engineer",
        "Инженер по компьютерному зрению",
        172500,
    ),
    "information-security-specialist": (
        "infosecspec",
        "Специалист по информационной безопасности",
        168036,
    ),
    "security-engineer": ("security_engineer", "Инженер по безопасности", 207333),
    "soc-analyst": ("SOC_analyst", "Аналитик SOC", 146000),
    "penetration-tester": ("pentester", "Пентестер", 170833),
}

SOURCES: dict[str, SalarySource] = {
    "habr_2026_h1": {
        "id": "habr_2026_h1",
        "name": "Хабр Карьера — зарплаты IT-специалистов",
        "url": "https://habr.com/ru/specials/1060148/",
        "methodology_url": "https://career.habr.com/info/salaries",
        "period": "I полугодие 2026",
        "published_at": "2026-07-21",
        "total_sample_size": 45226,
        "currency": "RUB",
        "tax_status": "net",
        "income_type": "salary_plus_bonus",
        "methodology_note": (
            "Анонимно указанные текущие доходы специалистов. На диаграммах Хабр "
            "Карьеры используется общий доход: медианный оклад плюс медианная премия; "
            "в серии исследований суммы приводятся на руки."
        ),
    },
    "habr_junior_2026": {
        "id": "habr_junior_2026",
        "name": "Хабр Карьера — высокооплачиваемые направления для Junior",
        "url": "https://habr.com/ru/companies/habr_career/articles/1040188/",
        "methodology_url": "https://career.habr.com/info/salaries",
        "period": "срез на 27 мая 2026",
        "published_at": "2026-05-27",
        "total_sample_size": None,
        "currency": "RUB",
        "tax_status": "net",
        "income_type": "salary_plus_bonus",
        "methodology_note": (
            "Профессиональные и грейдовые ориентиры из зарплатного калькулятора "
            "Хабр Карьеры; размер отдельных выборок в статье не опубликован."
        ),
    },
    "getgrade_2025": {
        "id": "getgrade_2025",
        "name": "Grades — зарплаты разработчиков в России",
        "url": "https://habr.com/ru/articles/981704/",
        "methodology_url": "https://habr.com/ru/articles/981704/#otkuda-dannye",
        "period": "2025",
        "published_at": "2025-12-29",
        "total_sample_size": 660,
        "currency": "RUB",
        "tax_status": "unknown",
        "income_type": "salary",
        "methodology_note": (
            "Анонимные данные разработчиков; авторы сообщают о проверке записей "
            "по сторонним базам и открытым данным. Gross/net в отчёте не указан."
        ),
    },
}

for _profession_slug, (_alias, _label, _median) in HABR_CALCULATOR_PUBLIC_MEDIANS.items():
    _source_id = f"habr_calculator_{_alias.lower()}_2026_07_22"
    SOURCES[_source_id] = {
        "id": _source_id,
        "name": f"Хабр Карьера — калькулятор зарплат: {_label}",
        "url": (
            "https://career.habr.com/salaries?"
            f"spec_aliases%5B%5D={_alias}&qualification=All"
        ),
        "methodology_url": "https://career.habr.com/info/salaries",
        "period": "публичный снимок 22 июля 2026",
        "published_at": "2026-07-22",
        "total_sample_size": None,
        "currency": "RUB",
        "tax_status": "unknown",
        "income_type": "salary_plus_bonus",
        "methodology_note": (
            "Зафиксирована только медиана общего дохода, которую отфильтрованная "
            "страница публично сообщает в title/description. Расширенные значения, "
            "скрытые входом в аккаунт, не извлекались. Живой калькулятор меняется; "
            "проект хранит датированный снимок и не утверждает gross/net."
        ),
    }


# label, national median, Moscow, Saint Petersburg, other Russian regions
CATEGORY_BENCHMARKS = {
    "development": ("Разработка", 223000, 270000, 247000, 200000),
    "quality": ("Тестирование", 163000, 200000, 190000, 150000),
    "infrastructure": ("Администрирование", 180000, 229000, 200000, 150000),
    "analytics": ("Аналитика", 194000, 220000, 180000, 160000),
    "security": ("Информационная безопасность", 165000, 224000, 151000, 130000),
}


DATA_AI_CATEGORY = {
    "data-engineer": "analytics",
    "analytics-engineer": "analytics",
    "database-administrator": "infrastructure",
    "postgresql-dba": "infrastructure",
    "data-scientist": "analytics",
    "machine-learning-engineer": "development",
    "mlops-engineer": "development",
    "nlp-engineer": "development",
    "computer-vision-engineer": "development",
}


# source label, P10, median, P90, scope, mapping note
ROLE_DISTRIBUTIONS = {
    "data-engineer": ("Инженер по данным", 100000, 240000, 413000, "exact_role", None),
    "analytics-engineer": (
        "Инженер по данным",
        100000,
        240000,
        413000,
        "related_role",
        "Ориентир смежной роли Data Engineer; отдельного среза Analytics Engineer нет.",
    ),
    "product-analyst": (
        "Продуктовый аналитик",
        100000,
        230000,
        399000,
        "exact_role",
        None,
    ),
    "system-analyst": ("Системный аналитик", 90000, 200000, 364000, "exact_role", None),
    "bi-analyst": (
        "BI-разработчик",
        104000,
        200000,
        369000,
        "related_role",
        "Источник публикует BI-разработчиков, а не отдельный срез BI-аналитиков.",
    ),
    "business-analyst": ("Бизнес-аналитик", 75000, 168000, 307000, "exact_role", None),
    "data-analyst": ("Аналитик по данным", 70000, 160000, 317000, "exact_role", None),
    "qa-automation": (
        "Инженер по автоматизации тестирования",
        100000,
        220000,
        379000,
        "exact_role",
        None,
    ),
    "sdet": (
        "Инженер по автоматизации тестирования",
        100000,
        220000,
        379000,
        "related_role",
        "SDET сопоставлен со смежным публичным срезом автоматизации тестирования.",
    ),
    "qa-manual": (
        "Инженер по обеспечению качества",
        86000,
        190000,
        334000,
        "related_role",
        "Публичный срез QA шире ручного тестирования.",
    ),
    "sre": ("Инженер по доступности сервисов", 126000, 300000, 538000, "exact_role", None),
    "devops-engineer": ("DevOps-инженер", 90000, 230000, 430000, "exact_role", None),
    "platform-engineer": (
        "DevOps-инженер",
        90000,
        230000,
        430000,
        "related_role",
        "Ориентир смежной инфраструктурной роли; отдельного Platform-среза нет.",
    ),
    "cloud-engineer": (
        "DevOps-инженер",
        90000,
        230000,
        430000,
        "related_role",
        "Ориентир смежной инфраструктурной роли; отдельного Cloud-среза нет.",
    ),
    "database-administrator": (
        "Администратор баз данных",
        67000,
        238000,
        443000,
        "exact_role",
        None,
    ),
    "postgresql-dba": (
        "Администратор баз данных",
        67000,
        238000,
        443000,
        "related_role",
        "Срез относится ко всем СУБД, не только PostgreSQL.",
    ),
    "network-engineer": ("Сетевой инженер", 80000, 160000, 316000, "exact_role", None),
    "system-administrator": (
        "Системный администратор",
        60000,
        120000,
        240000,
        "exact_role",
        None,
    ),
}


# source label and regional medians: Moscow, Saint Petersburg, other regions
REGIONAL_ROLE_MEDIANS = {
    "backend-developer": ("Бэкенд-разработчик", 278000, 251000, 220000, "exact_role", None),
    "frontend-developer": ("Фронтенд-разработчик", 260000, 230000, 200000, "exact_role", None),
    "fullstack-developer": ("Фулстек-разработчик", 241000, 234000, 188000, "exact_role", None),
    "1c-developer": ("Программист 1С", 272000, 198000, 174000, "exact_role", None),
    "game-developer": ("Разработчик игр", 235000, 215000, 150000, "exact_role", None),
    "unity-developer": (
        "Разработчик игр",
        235000,
        215000,
        150000,
        "related_role",
        "Срез относится ко всем разработчикам игр, без отдельного фильтра Unity.",
    ),
    "unreal-engine-developer": (
        "Разработчик игр",
        235000,
        215000,
        150000,
        "related_role",
        "Срез относится ко всем разработчикам игр, без отдельного фильтра Unreal Engine.",
    ),
    "embedded-developer": (
        "Инженер встраиваемых систем",
        200000,
        204000,
        138000,
        "exact_role",
        None,
    ),
    "firmware-engineer": (
        "Инженер встраиваемых систем",
        200000,
        204000,
        138000,
        "related_role",
        "Firmware сопоставлен с более широким срезом встраиваемых систем.",
    ),
    "solution-architect": (
        "Архитектор программного обеспечения",
        497000,
        508000,
        420000,
        "related_role",
        "Источник публикует архитекторов ПО, а не только архитекторов решений.",
    ),
}


MOBILE_REGIONAL = ("Разработчик мобильных приложений", 320000, 299000, 263000)
for _mobile_slug in (
    "android-developer",
    "ios-developer",
    "flutter-developer",
    "react-native-developer",
):
    REGIONAL_ROLE_MEDIANS[_mobile_slug] = (
        *MOBILE_REGIONAL,
        "related_role",
        "Публичный срез объединяет все платформы мобильной разработки.",
    )


# source label, median, mapping note
TECHNOLOGY_MEDIANS = {
    "java-developer": ("Java", 279000, None),
    "go-developer": ("Golang", 325000, None),
    "ruby-developer": ("Ruby", 323000, None),
    "ios-developer": ("Swift", 326000, "Технологический, а не ролевой срез."),
    "android-developer": ("Kotlin", 320000, "Технологический, а не ролевой срез."),
    "cpp-developer": ("C++", 254000, None),
    "dotnet-developer": ("C#", 250000, None),
    "python-developer": ("Python", 243000, None),
    "php-developer": ("PHP", 242000, None),
    "javascript-typescript-developer": (
        "JavaScript",
        236000,
        "В публичном отчёте нет отдельного значения TypeScript.",
    ),
    "firmware-engineer": ("C", 220000, "Технологический ориентир для части Firmware-ролей."),
}


# slug -> seniority, metric, value, lower, upper, sample, source, scope, label, note
SENIORITY_POINTS: dict[str, list[SeniorityPoint]] = {
    "product-analyst": [
        (
            "junior",
            "average",
            139000,
            None,
            None,
            None,
            "habr_junior_2026",
            "exact_role",
            "Продуктовый аналитик",
            None,
        ),
        (
            "middle",
            "average",
            243000,
            None,
            None,
            None,
            "habr_junior_2026",
            "exact_role",
            "Продуктовый аналитик",
            None,
        ),
        (
            "senior",
            "average",
            358000,
            None,
            None,
            None,
            "habr_junior_2026",
            "exact_role",
            "Продуктовый аналитик",
            None,
        ),
    ],
    "machine-learning-engineer": [
        (
            "junior",
            "average",
            115000,
            None,
            None,
            None,
            "habr_junior_2026",
            "exact_role",
            "ML-разработчик",
            None,
        ),
    ],
    "java-developer": [
        (
            "middle",
            "median",
            242000,
            None,
            None,
            36,
            "getgrade_2025",
            "exact_role",
            "Java Backend",
            None,
        ),
        (
            "senior",
            "median",
            395000,
            None,
            None,
            37,
            "getgrade_2025",
            "exact_role",
            "Java Backend",
            None,
        ),
    ],
    "backend-developer": [
        (
            "middle",
            "median",
            242000,
            None,
            None,
            36,
            "getgrade_2025",
            "related_role",
            "Java Backend",
            "Стек-специфичный ориентир Java Backend.",
        ),
        (
            "senior",
            "median",
            395000,
            None,
            None,
            37,
            "getgrade_2025",
            "related_role",
            "Java Backend",
            "Стек-специфичный ориентир Java Backend.",
        ),
    ],
    "frontend-developer": [
        (
            "middle",
            "median",
            258000,
            None,
            None,
            28,
            "getgrade_2025",
            "related_role",
            "React",
            "Стек-специфичный ориентир React.",
        ),
        (
            "senior",
            "median",
            330000,
            None,
            None,
            18,
            "getgrade_2025",
            "related_role",
            "React",
            "Стек-специфичный ориентир React.",
        ),
    ],
    "javascript-typescript-developer": [
        (
            "middle",
            "median",
            258000,
            None,
            None,
            28,
            "getgrade_2025",
            "related_role",
            "React",
            "Стек-специфичный ориентир React.",
        ),
        (
            "senior",
            "median",
            330000,
            None,
            None,
            18,
            "getgrade_2025",
            "related_role",
            "React",
            "Стек-специфичный ориентир React.",
        ),
    ],
    "devops-engineer": [
        ("middle", "median", 250000, None, None, 26, "getgrade_2025", "exact_role", "DevOps", None),
        ("senior", "median", 407000, None, None, 13, "getgrade_2025", "exact_role", "DevOps", None),
    ],
    "python-developer": [
        (
            "middle",
            "median",
            294000,
            None,
            None,
            7,
            "getgrade_2025",
            "technology",
            "Python",
            "Малая выборка; используйте как ориентир.",
        ),
        (
            "senior",
            "median",
            416000,
            None,
            None,
            7,
            "getgrade_2025",
            "technology",
            "Python",
            "Малая выборка; используйте как ориентир.",
        ),
    ],
    "dotnet-developer": [
        (
            "middle",
            "median",
            315000,
            None,
            None,
            6,
            "getgrade_2025",
            "technology",
            ".NET",
            "Малая выборка; авторы отмечают возможный выброс.",
        ),
        (
            "senior",
            "median",
            311000,
            None,
            None,
            10,
            "getgrade_2025",
            "technology",
            ".NET",
            "Малая выборка; авторы отмечают возможный выброс.",
        ),
    ],
}


for _mobile_slug in (
    "android-developer",
    "ios-developer",
    "flutter-developer",
    "react-native-developer",
):
    SENIORITY_POINTS[_mobile_slug] = [
        (
            "middle",
            "median",
            312000,
            None,
            None,
            14,
            "getgrade_2025",
            "related_role",
            "Mobile (iOS, Android)",
            "Общий мобильный срез; малая выборка.",
        ),
        (
            "senior",
            "median",
            403000,
            None,
            None,
            9,
            "getgrade_2025",
            "related_role",
            "Mobile (iOS, Android)",
            "Общий мобильный срез; малая выборка.",
        ),
    ]


DEVELOPER_MARKET_LEVEL_SLUGS = {
    "frontend-developer",
    "backend-developer",
    "fullstack-developer",
    "java-developer",
    "python-developer",
    "go-developer",
    "dotnet-developer",
    "cpp-developer",
    "php-developer",
    "ruby-developer",
    "javascript-typescript-developer",
    "android-developer",
    "ios-developer",
    "flutter-developer",
    "react-native-developer",
    "game-developer",
    "unity-developer",
    "unreal-engine-developer",
    "embedded-developer",
    "firmware-engineer",
    "1c-developer",
    "sap-developer",
    "solution-architect",
}


DEVELOPER_MARKET_LEVELS = [
    ("junior", 100000, 130000, 55),
    ("middle", 230000, 270000, 288),
    ("senior", 370000, 380000, 209),
]


def _point(
    *,
    source_id: str,
    scope: str,
    label: str,
    geography: str = "russia",
    metric: str = "median",
    value: int | None = None,
    lower: int | None = None,
    upper: int | None = None,
    p10: int | None = None,
    p90: int | None = None,
    seniority: str | None = None,
    sample_size: int | None = None,
    note: str | None = None,
    is_fallback: bool = False,
) -> dict[str, Any]:
    return {
        "source_id": source_id,
        "scope": scope,
        "label": label,
        "geography": geography,
        "metric": metric,
        "value": value,
        "lower": lower,
        "upper": upper,
        "p10": p10,
        "p90": p90,
        "seniority": seniority,
        "sample_size": sample_size,
        "note": note,
        "is_fallback": is_fallback,
    }


def _category_key(slug: str, category_slug: str) -> str:
    if category_slug == "data-ai":
        return DATA_AI_CATEGORY[slug]
    if category_slug in {"specialized", "architecture"}:
        return "development"
    return category_slug


def salary_benchmark_for(slug: str, category_slug: str) -> dict[str, Any]:
    """Return a fully sourced benchmark layer for a profession."""
    points: list[dict[str, Any]] = []

    calculator_snapshot = HABR_CALCULATOR_PUBLIC_MEDIANS.get(slug)
    if calculator_snapshot:
        alias, label, median = calculator_snapshot
        points.append(
            _point(
                source_id=f"habr_calculator_{alias.lower()}_2026_07_22",
                scope="exact_role",
                label=label,
                value=median,
                note=(
                    "Публичная SEO-медиана живого калькулятора на дату снимка; "
                    "размер выборки и gross/net публично не подтверждены."
                ),
            )
        )

    distribution = ROLE_DISTRIBUTIONS.get(slug)
    if distribution:
        label, p10, median, p90, scope, note = distribution
        points.append(
            _point(
                source_id="habr_2026_h1",
                scope=scope,
                label=label,
                value=median,
                p10=p10,
                p90=p90,
                note=note,
            )
        )

    technology = TECHNOLOGY_MEDIANS.get(slug)
    if technology:
        label, median, note = technology
        points.append(
            _point(
                source_id="habr_2026_h1",
                scope="technology",
                label=label,
                value=median,
                note=note,
            )
        )

    regional = REGIONAL_ROLE_MEDIANS.get(slug)
    if regional:
        label, moscow, petersburg, regions, scope, note = regional
        for geography, value in (
            ("moscow", moscow),
            ("saint_petersburg", petersburg),
            ("regions", regions),
        ):
            points.append(
                _point(
                    source_id="habr_2026_h1",
                    scope=scope,
                    label=label,
                    geography=geography,
                    value=value,
                    note=note,
                )
            )

    for seniority_point in SENIORITY_POINTS.get(slug, []):
        (
            seniority,
            metric,
            value,
            lower,
            upper,
            sample_size,
            source_id,
            scope,
            label,
            note,
        ) = seniority_point
        points.append(
            _point(
                source_id=source_id,
                scope=scope,
                label=label,
                metric=metric,
                value=value,
                lower=lower,
                upper=upper,
                seniority=seniority,
                sample_size=sample_size,
                note=note,
            )
        )

    if slug in DEVELOPER_MARKET_LEVEL_SLUGS:
        existing_levels = {point["seniority"] for point in points if point["seniority"] is not None}
        for seniority, lower, upper, sample_size in DEVELOPER_MARKET_LEVELS:
            if seniority in existing_levels:
                continue
            points.append(
                _point(
                    source_id="getgrade_2025",
                    scope="market_level",
                    label="Разработчики всех стеков",
                    metric="range",
                    lower=lower,
                    upper=upper,
                    seniority=seniority,
                    sample_size=sample_size,
                    note="Общий грейдовый ориентир рынка разработки, не оценка этой роли.",
                    is_fallback=True,
                )
            )

    category_key = _category_key(slug, category_slug)
    label, national, moscow, petersburg, regions = CATEGORY_BENCHMARKS[category_key]
    for geography, value in (
        ("russia", national),
        ("moscow", moscow),
        ("saint_petersburg", petersburg),
        ("regions", regions),
    ):
        points.append(
            _point(
                source_id="habr_2026_h1",
                scope="category",
                label=label,
                geography=geography,
                value=value,
                note="Категорийный ориентир; не выдаётся за зарплату конкретной профессии.",
                is_fallback=True,
            )
        )

    specific_scopes = {point["scope"] for point in points if not point["is_fallback"]}
    if specific_scopes & {"exact_role", "technology"}:
        coverage = "direct"
    elif "related_role" in specific_scopes:
        coverage = "related"
    else:
        coverage = "category"

    source_ids = list(dict.fromkeys(point["source_id"] for point in points))
    return {
        "coverage": coverage,
        "points": points,
        "sources": [SOURCES[source_id] for source_id in source_ids],
        "methodology_note": (
            "Ориентиры фактических доходов показаны отдельно от вилок вакансий. "
            "Точный ролевой срез имеет приоритет; технологический или смежный срез "
            "помечен явно. Категорийный срез используется только как fallback."
        ),
    }
