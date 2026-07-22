from app.dagster_defs import defs, nightly_schedule


def test_dagster_midnight_moscow_schedule_is_enabled() -> None:
    assert nightly_schedule.cron_schedule == "0 0 * * *"
    assert nightly_schedule.execution_timezone == "Europe/Moscow"
    assert nightly_schedule.name == "techrole_midnight_moscow"
    assert defs.get_job_def("techrole_nightly_market_pipeline").name == (
        "techrole_nightly_market_pipeline"
    )
    assert {
        node.name
        for node in defs.get_job_def("techrole_nightly_market_pipeline").graph.node_defs
    } == {
        "snapshot_official_currency_rates",
        "verify_public_salary_benchmarks",
        "collect_and_classify_open_vacancies",
        "materialize_observed_publication_metrics",
    }
