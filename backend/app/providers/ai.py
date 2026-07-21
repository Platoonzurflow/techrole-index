import json
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings
from app.domain.classifier import Classification


class AiClassificationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profession_slug: str | None
    seniority: Literal["junior", "middle", "senior"] | None
    confidence: float = Field(ge=0, le=1)


class OllamaOptionalClassifier:
    """Assistant for uncertain vacancies only; callers must enforce a confidence threshold."""

    def __init__(self, settings: Settings, allowed_slugs: set[str] | None = None):
        if not settings.ai_classifier_enabled or not settings.ollama_model:
            raise RuntimeError("Optional AI classifier is disabled or has no model")
        self.url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_model
        self.timeout = settings.ai_classifier_timeout_seconds
        self.allowed_slugs = allowed_slugs

    def classify(self, title: str, description: str = "") -> Classification | None:
        allowed = ", ".join(sorted(self.allowed_slugs or ()))
        response_schema = AiClassificationPayload.model_json_schema()
        if self.allowed_slugs is not None:
            response_schema["properties"]["profession_slug"] = {
                "anyOf": [
                    {"type": "string", "enum": sorted(self.allowed_slugs)},
                    {"type": "null"},
                ]
            }
        prompt = "\n".join(
            (
                "Классифицируй IT-вакансию. Верни только JSON без markdown.",
                "profession_slug: один slug из разрешённого списка или null.",
                "seniority: junior, middle, senior или null.",
                "confidence: число от 0 до 1.",
                f"Разрешённые slug: {allowed or 'не ограничены'}.",
                f"Название: {title}",
                f"Описание: {description[:1200]}",
                f"JSON Schema: {json.dumps(response_schema, ensure_ascii=False)}",
            )
        )
        response = httpx.post(
            f"{self.url}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "format": response_schema,
                "think": False,
                "keep_alive": "10m",
                "options": {"temperature": 0, "num_ctx": 4096, "num_predict": 128},
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json().get("response", {})
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                return None
        try:
            validated = AiClassificationPayload.model_validate(payload)
        except ValidationError:
            return None
        profession_slug = validated.profession_slug
        if (
            profession_slug is not None
            and self.allowed_slugs is not None
            and profession_slug not in self.allowed_slugs
        ):
            return None
        confidence = min(0.79, validated.confidence)
        return Classification(
            profession_slug,
            validated.seniority,
            confidence,
            ("optional-ai-assist",),
        )

    def unload(self) -> None:
        try:
            httpx.post(
                f"{self.url}/api/generate",
                json={"model": self.model, "prompt": "", "keep_alive": 0},
                timeout=30,
            ).raise_for_status()
        except httpx.HTTPError:
            pass
