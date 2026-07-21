import re
import unicodedata
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
    version = "rules-v1"

    def __init__(
        self, aliases: dict[str, list[str]], exclusions: dict[str, list[str]] | None = None
    ):
        self.aliases = aliases
        self.exclusions = exclusions or {}

    def classify(self, title: str, experience: str | None = None) -> Classification:
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
            return Classification(
                None, seniority, min(level_confidence, 0.35), tuple(reasons + ["нет алиаса"])
            )
        slug, length, alias = max(matches, key=lambda item: item[1])
        alias_confidence = min(0.98, 0.72 + length / 100)
        confidence = round((alias_confidence * 0.75) + (level_confidence * 0.25), 4)
        return Classification(slug, seniority, confidence, tuple([f"алиас: {alias}"] + reasons))
