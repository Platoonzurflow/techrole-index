from app.domain.classifier import RuleBasedClassifier, classify_seniority, normalize_title


def test_normalization_and_alias_explanation():
    classifier = RuleBasedClassifier(
        {"python-developer": ["python developer", "python разработчик"]}
    )
    result = classifier.classify("  Senior   PYTHON Developer ")
    assert normalize_title("SÉNIOR  Developer") == "sénior developer"
    assert result.profession_slug == "python-developer"
    assert result.seniority == "senior"
    assert result.confidence > 0.8
    assert "алиас" in result.reasons[0]


def test_lead_and_architect_are_not_automatically_senior():
    for title in (
        "Team Lead Python",
        "Solution Architect",
        "Principal Engineer",
        "Архитектор решений",
    ):
        level, confidence, reason = classify_seniority(title, "between3and6")
        assert level is None
        assert confidence < 0.5
        assert reason


def test_experience_is_lower_confidence_fallback():
    level, confidence, _ = classify_seniority("Разработчик", "between1and3")
    assert level == "middle"
    assert confidence < 0.7
