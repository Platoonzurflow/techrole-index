import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Classification:
    profession_slug: str | None
    seniority: str | None
    confidence: float
    reasons: tuple[str, ...]


class OptionalAiClassifier(Protocol):
    """Optional fallback; implementations must only handle uncertain records."""

    def classify(self, title: str, description: str = "") -> Classification | None: ...


SENIORITY_PATTERNS: dict[str, tuple[str, ...]] = {
    "junior": (
        r"\bjunior\b",
        r"\bjr\.?\b",
        r"\btrainee\b",
        r"\bintern\b",
        r"\bстаж[её]р\b",
        r"\bмладш(?:ий|ая)\b",
        r"\bначинающ(?:ий|ая)\b",
    ),
    "middle": (r"\bmiddle\b", r"\bmid(?:dle)?\b", r"\bмидл\b", r"\bсредн(?:ий|яя)\b"),
    "senior": (r"\bsenior\b", r"\bsr\.?\b", r"\bсеньор\b", r"\bстарш(?:ий|ая)\b"),
}


GENERIC_SOFTWARE_TITLE = re.compile(
    r"\b(?:инженер[- ]?программист|системн(?:ый|ого)\s+программист|программист|"
    r"программист[- ]разработчик|разработчик\s+программного\s+обеспечения|"
    r"software\s+(?:engineer|developer))\b"
)


SKILL_ROLE_PATTERNS: dict[str, tuple[str, ...]] = {
    "computer-vision-engineer": (r"\bopencv\b", r"\bcomputer\s+vision\b"),
    "nlp-engineer": (r"\bnlp\b", r"computational\s+linguist"),
    "mlops-engineer": (r"\bmlops\b",),
    "machine-learning-engineer": (
        r"\bpytorch\b",
        r"\btensorflow\b",
        r"\bscikit[- ]learn\b",
        r"\bml[- ]фреймворк",
    ),
    "analytics-engineer": (r"\bdbt\b",),
    "data-engineer": (r"\bapache\s+airflow\b", r"\bapache\s+spark\b", r"\betl\b"),
    "react-native-developer": (r"\breact\s+native\b",),
    "flutter-developer": (r"\bflutter\b", r"\bdart\b"),
    "android-developer": (r"\bandroid\b",),
    "ios-developer": (r"\bios\b", r"\bswift\b", r"\bobjective-c\b"),
    "unity-developer": (r"\bunity\b",),
    "unreal-engine-developer": (r"\bunreal\s+engine\b",),
    "sap-developer": (r"\babap\b", r"\bsap\b"),
    "1c-developer": (r"(?:^|\s)1[сc](?:\s|$)", r"\b1[сc]:предприятие\b"),
    "dotnet-developer": (r"\.net\b", r"\basp\.net\b", r"c#"),
    "cpp-developer": (r"c\+\+",),
    "java-developer": (r"\bjava\b",),
    "python-developer": (r"\bpython\b", r"\bпитон\b"),
    "go-developer": (r"\bgolang\b",),
    "php-developer": (r"\bphp\b",),
    "ruby-developer": (r"\bruby\b", r"\bruby\s+on\s+rails\b"),
    "javascript-typescript-developer": (r"\bjavascript\b", r"\btypescript\b"),
    "embedded-developer": (
        r"\bмикроконтроллер",
        r"\bmicrocontroller\b",
        r"\bпрограммируемый\s+логический\s+контроллер\b",
        r"\bembedded\b",
    ),
}


def normalize_title(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower().replace("ё", "е")
    value = re.sub(r"[^\w+#./-]+", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def classify_seniority(
    title: str, experience: str | None = None
) -> tuple[str | None, float, list[str]]:
    normalized = normalize_title(title)
    # Lead/principal/architect are intentionally not promoted to Senior automatically.
    if re.search(
        r"\b(team\s*lead|тимлид|руководитель|architect|архитектор|principal)\b", normalized
    ):
        return None, 0.35, ["отдельная lead/architect роль"]
    for level, patterns in SENIORITY_PATTERNS.items():
        if any(re.search(pattern, normalized) for pattern in patterns):
            return level, 0.96, [f"маркер уровня в названии: {level}"]
    experience_key = (experience or "").lower()
    if experience_key in {"no_experience", "нет опыта", "0"}:
        return "junior", 0.72, ["опыт не требуется"]
    if experience_key in {"between1and3", "1-3", "от 1 года до 3 лет"}:
        return "middle", 0.62, ["поле опыта 1–3 года"]
    if experience_key in {"between3and6", "morethan6", "3-6", "6+"}:
        return "senior", 0.62, ["поле опыта от 3 лет"]
    return None, 0.2, ["уровень не определён"]


class RuleBasedClassifier:
    version = "rules-v2"

    def __init__(
        self, aliases: dict[str, list[str]], exclusions: dict[str, list[str]] | None = None
    ):
        self.aliases = aliases
        self.exclusions = exclusions or {}

    @staticmethod
    def _classify_generic_software_skills(
        normalized_title: str, skills: Iterable[str]
    ) -> tuple[str | None, str | None]:
        if not GENERIC_SOFTWARE_TITLE.search(normalized_title):
            return None, None
        normalized_skills = " | ".join(
            normalize_title(skill) for skill in skills if skill and skill.strip()
        )
        if not normalized_skills:
            return None, None
        matches = {
            slug
            for slug, patterns in SKILL_ROLE_PATTERNS.items()
            if any(re.search(pattern, normalized_skills) for pattern in patterns)
        }

        # Prefer a more specific role when its expected base technology also matched.
        if "computer-vision-engineer" in matches:
            matches -= {"cpp-developer", "python-developer", "machine-learning-engineer"}
        if "nlp-engineer" in matches:
            matches -= {"python-developer", "machine-learning-engineer"}
        if "mlops-engineer" in matches:
            matches -= {"python-developer", "go-developer", "machine-learning-engineer"}
        if "android-developer" in matches:
            matches.discard("java-developer")
        if "embedded-developer" in matches:
            matches.discard("cpp-developer")

        if len(matches) != 1:
            return None, None
        slug = next(iter(matches))
        return slug, f"однозначный стек для общего software-title: {slug}"

    def classify(
        self,
        title: str,
        experience: str | None = None,
        skills: Iterable[str] = (),
    ) -> Classification:
        normalized = normalize_title(title)
        matches: list[tuple[str, int, str]] = []
        for slug, aliases in self.aliases.items():
            if any(re.search(pattern, normalized) for pattern in self.exclusions.get(slug, [])):
                continue
            for alias in aliases:
                pattern = (
                    alias
                    if alias.startswith("^") or "\\b" in alias
                    else rf"\b{re.escape(alias.lower())}\b"
                )
                if re.search(pattern, normalized):
                    matches.append((slug, len(alias), alias))
        seniority, level_confidence, reasons = classify_seniority(title, experience)
        if not matches:
            skill_slug, skill_reason = self._classify_generic_software_skills(normalized, skills)
            if skill_slug is not None:
                confidence = round((0.84 * 0.8) + (level_confidence * 0.2), 4)
                return Classification(
                    skill_slug,
                    seniority,
                    confidence,
                    tuple([skill_reason or "однозначный стек"] + reasons),
                )
            return Classification(
                None, seniority, min(level_confidence, 0.35), tuple(reasons + ["нет алиаса"])
            )
        slug, length, alias = max(matches, key=lambda item: item[1])
        alias_confidence = min(0.98, 0.72 + length / 100)
        confidence = round((alias_confidence * 0.75) + (level_confidence * 0.25), 4)
        return Classification(slug, seniority, confidence, tuple([f"алиас: {alias}"] + reasons))
