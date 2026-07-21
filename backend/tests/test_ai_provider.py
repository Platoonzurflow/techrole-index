import json
from typing import Any

from app.config import Settings
from app.providers.ai import OllamaOptionalClassifier


class FakeResponse:
    def __init__(self, payload: dict[str, Any]):
        self.payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self.payload


def test_ollama_classifier_validates_slug_and_caps_confidence(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, *, json: dict[str, Any], timeout: int) -> FakeResponse:
        captured.update({"url": url, "json": json, "timeout": timeout})
        return FakeResponse(
            {
                "response": json_module.dumps(
                    {
                        "profession_slug": "python-developer",
                        "seniority": "middle",
                        "confidence": 0.97,
                    }
                )
            }
        )

    json_module = json
    monkeypatch.setattr("app.providers.ai.httpx.post", fake_post)
    classifier = OllamaOptionalClassifier(
        Settings(
            ai_classifier_enabled=True,
            ollama_model="qwen3.6:27b",
            ai_classifier_timeout_seconds=300,
        ),
        {"python-developer"},
    )

    result = classifier.classify("Middle Python разработчик", "Python SQL")

    assert result is not None
    assert result.profession_slug == "python-developer"
    assert result.seniority == "middle"
    assert result.confidence == 0.79
    assert captured["timeout"] == 300
    assert captured["json"]["think"] is False
    assert captured["json"]["options"]["num_ctx"] == 4096
    assert captured["json"]["format"]["type"] == "object"
    assert captured["json"]["format"]["additionalProperties"] is False
    assert captured["json"]["format"]["properties"]["profession_slug"]["anyOf"][0][
        "enum"
    ] == ["python-developer"]
    assert "JSON Schema:" in captured["json"]["prompt"]


def test_ollama_classifier_rejects_unknown_slug(monkeypatch) -> None:
    def fake_post(url: str, *, json: dict[str, Any], timeout: int) -> FakeResponse:
        del url, json, timeout
        return FakeResponse(
            {
                "response": '{"profession_slug":"invented-role","seniority":"senior","confidence":0.8}'
            }
        )

    monkeypatch.setattr("app.providers.ai.httpx.post", fake_post)
    classifier = OllamaOptionalClassifier(
        Settings(ai_classifier_enabled=True, ollama_model="qwen3.6:27b"),
        {"python-developer"},
    )

    assert classifier.classify("Unknown title") is None


def test_ollama_classifier_rejects_payload_outside_schema(monkeypatch) -> None:
    def fake_post(url: str, *, json: dict[str, Any], timeout: int) -> FakeResponse:
        del url, json, timeout
        return FakeResponse(
            {
                "response": json_module.dumps(
                    {
                        "profession_slug": "python-developer",
                        "seniority": "lead",
                        "confidence": 1.5,
                        "explanation": "unexpected field",
                    }
                )
            }
        )

    json_module = json
    monkeypatch.setattr("app.providers.ai.httpx.post", fake_post)
    classifier = OllamaOptionalClassifier(
        Settings(ai_classifier_enabled=True, ollama_model="qwen3.6:27b"),
        {"python-developer"},
    )

    assert classifier.classify("Python lead") is None


def test_ollama_classifier_rejects_malformed_json(monkeypatch) -> None:
    def fake_post(url: str, *, json: dict[str, Any], timeout: int) -> FakeResponse:
        del url, json, timeout
        return FakeResponse({"response": "not-json"})

    monkeypatch.setattr("app.providers.ai.httpx.post", fake_post)
    classifier = OllamaOptionalClassifier(
        Settings(ai_classifier_enabled=True, ollama_model="qwen3.6:27b"),
        {"python-developer"},
    )

    assert classifier.classify("Python") is None
