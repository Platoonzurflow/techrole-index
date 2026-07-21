from app.data.catalog import PROFESSIONS
from app.data.tech_stacks import TECH_STACKS, tech_stack_for


def test_every_catalog_profession_has_a_specific_tech_stack():
    catalog_slugs = {item[0] for item in PROFESSIONS}
    assert set(TECH_STACKS) == catalog_slugs
    for slug in catalog_slugs:
        groups = tech_stack_for(slug)
        assert len(groups) >= 3
        assert all(group["title"] and group["items"] for group in groups)
