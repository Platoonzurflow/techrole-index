from app.providers.vacancies import DemoVacancyProvider


def test_demo_provider_is_reproducible_and_includes_edge_cases():
    first = list(DemoVacancyProvider(42).fetch("Python Developer", "msk", limit=30))
    second = list(DemoVacancyProvider(42).fetch("Python Developer", "msk", limit=30))
    assert first == second
    assert {item.title.split()[0] for item in first} == {"Junior", "Middle", "Senior"}
    assert any(item.salary_from is None for item in first)
    assert any(item.salary_from is not None and item.salary_to is None for item in first)
    assert len({item.currency for item in first if item.currency}) > 1
