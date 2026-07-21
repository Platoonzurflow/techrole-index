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


def test_generic_software_title_uses_only_an_unambiguous_skill_signal():
    classifier = RuleBasedClassifier({"computer-vision-engineer": []})
    result = classifier.classify(
        "Инженер-программист",
        "between1and3",
        ["OpenCV", "C++", "Linux"],
    )

    assert result.profession_slug == "computer-vision-engineer"
    assert result.seniority == "middle"
    assert result.confidence > 0.75
    assert "стек" in result.reasons[0]


def test_ambiguous_skills_abstain_for_a_generic_title():
    classifier = RuleBasedClassifier({"java-developer": [], "python-developer": []})
    result = classifier.classify(
        "Программист",
        None,
        ["Java", "Python"],
    )

    assert result.profession_slug is None
    assert "нет алиаса" in result.reasons


def test_skills_do_not_classify_a_non_software_title():
    classifier = RuleBasedClassifier({"python-developer": []})
    result = classifier.classify("Маркетолог", None, ["Python"])

    assert result.profession_slug is None


def test_explicit_title_alias_has_priority_over_conflicting_skills():
    classifier = RuleBasedClassifier({"python-developer": ["python developer"]})
    result = classifier.classify("Python Developer", None, ["Java"])

    assert result.profession_slug == "python-developer"
    assert result.reasons[0] == "алиас: python developer"
