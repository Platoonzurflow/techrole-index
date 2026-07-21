-- Reference transform for a future source with confirmed active-state and tax semantics.
-- Do not run this against the official publication layer: its real transform is packaged
-- as app/sql/observed_publication_metrics_daily.sql and never overwrites prepared metrics.
-- Midpoint is intentionally available only when both normalized bounds exist.
WITH active_vacancies AS (
    SELECT
        s.snapshot_date AS metric_date,
        v.profession_id,
        v.seniority_id,
        v.region_id,
        o.gross,
        v.id AS vacancy_id,
        v.is_remote,
        o.salary_from,
        o.salary_to,
        CASE WHEN o.salary_from IS NOT NULL AND o.salary_to IS NOT NULL
             THEN (o.salary_from + o.salary_to) / 2 END AS midpoint
    FROM vacancy_snapshots s
    JOIN vacancies v ON v.id = s.vacancy_id
    LEFT JOIN salary_observations o
      ON o.vacancy_id = v.id AND o.observed_date = s.snapshot_date
    WHERE s.is_active AND v.profession_id IS NOT NULL AND v.seniority_id IS NOT NULL
)
SELECT
    metric_date,
    profession_id,
    seniority_id,
    region_id,
    gross,
    count(DISTINCT vacancy_id) AS vacancy_count,
    count(DISTINCT vacancy_id) FILTER (WHERE salary_from IS NOT NULL OR salary_to IS NOT NULL) AS salary_count,
    count(DISTINCT vacancy_id) FILTER (WHERE salary_from IS NOT NULL OR salary_to IS NOT NULL)::numeric
        / NULLIF(count(DISTINCT vacancy_id), 0) AS salary_coverage,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY midpoint) FILTER (WHERE midpoint IS NOT NULL) AS salary_median,
    avg(midpoint) FILTER (WHERE midpoint IS NOT NULL) AS salary_average,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY midpoint) FILTER (WHERE midpoint IS NOT NULL) AS salary_p25,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY midpoint) FILTER (WHERE midpoint IS NOT NULL) AS salary_p75,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY salary_from) FILTER (WHERE salary_from IS NOT NULL) AS lower_bound_median,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY salary_to) FILTER (WHERE salary_to IS NOT NULL) AS upper_bound_median,
    count(midpoint) AS sample_size,
    avg(is_remote::int) AS remote_share
FROM active_vacancies
GROUP BY metric_date, profession_id, seniority_id, region_id, gross;
