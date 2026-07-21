WITH latest_salary AS MATERIALIZED (
    SELECT DISTINCT ON (observation.vacancy_id)
        observation.vacancy_id,
        observation.gross,
        observation.salary_from,
        observation.salary_to
    FROM salary_observations AS observation
    WHERE observation.normalized_currency = 'RUB'
    ORDER BY observation.vacancy_id, observation.observed_date DESC, observation.id DESC
), base AS MATERIALIZED (
    SELECT
        (vacancy.published_at AT TIME ZONE 'UTC')::date AS metric_date,
        vacancy.source_id,
        vacancy.profession_id,
        COALESCE(seniority.code, 'unknown') AS seniority_code,
        vacancy.region_id,
        CASE COALESCE(latest_salary.gross, vacancy.salary_gross)
            WHEN TRUE THEN 'gross'
            WHEN FALSE THEN 'net'
            ELSE 'unknown'
        END AS salary_tax_status,
        COALESCE(
            latest_salary.salary_from,
            CASE WHEN vacancy.currency = 'RUB' THEN vacancy.salary_from END
        ) AS salary_from,
        COALESCE(
            latest_salary.salary_to,
            CASE WHEN vacancy.currency = 'RUB' THEN vacancy.salary_to END
        ) AS salary_to,
        vacancy.is_remote,
        vacancy.last_seen_at
    FROM vacancies AS vacancy
    LEFT JOIN seniority_levels AS seniority ON seniority.id = vacancy.seniority_id
    LEFT JOIN latest_salary ON latest_salary.vacancy_id = vacancy.id
    WHERE vacancy.source_id = :source_id
      AND vacancy.profession_id IS NOT NULL
      AND vacancy.published_at >= (
          CAST(:date_from AS date)::timestamp AT TIME ZONE 'UTC'
      )
      AND vacancy.published_at < (
          (CAST(:date_to AS date) + 1)::timestamp AT TIME ZONE 'UTC'
      )
), aggregated_raw AS MATERIALIZED (
    SELECT
        metric_date,
        source_id,
        profession_id,
        seniority_code,
        region_id,
        salary_tax_status,
        'RUB'::varchar(3) AS normalized_currency,
        count(*)::integer AS publication_count,
        count(*) FILTER (
            WHERE salary_from IS NOT NULL OR salary_to IS NOT NULL
        )::integer AS salary_disclosed_count,
        count(*) FILTER (
            WHERE salary_from IS NOT NULL AND salary_to IS NOT NULL
        )::integer AS midpoint_sample_size,
        percentile_cont(0.50) WITHIN GROUP (
            ORDER BY (salary_from + salary_to) / 2
        ) FILTER (
            WHERE salary_from IS NOT NULL AND salary_to IS NOT NULL
        ) AS salary_median_raw,
        avg((salary_from + salary_to) / 2) FILTER (
            WHERE salary_from IS NOT NULL AND salary_to IS NOT NULL
        ) AS salary_average_raw,
        percentile_cont(0.25) WITHIN GROUP (
            ORDER BY (salary_from + salary_to) / 2
        ) FILTER (
            WHERE salary_from IS NOT NULL AND salary_to IS NOT NULL
        ) AS salary_p25_raw,
        percentile_cont(0.75) WITHIN GROUP (
            ORDER BY (salary_from + salary_to) / 2
        ) FILTER (
            WHERE salary_from IS NOT NULL AND salary_to IS NOT NULL
        ) AS salary_p75_raw,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY salary_from) FILTER (
            WHERE salary_from IS NOT NULL
        ) AS lower_bound_median_raw,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY salary_to) FILTER (
            WHERE salary_to IS NOT NULL
        ) AS upper_bound_median_raw,
        count(*) FILTER (WHERE is_remote)::integer AS remote_count,
        max(last_seen_at) AS last_ingested_at
    FROM base
    GROUP BY
        metric_date,
        source_id,
        profession_id,
        seniority_code,
        region_id,
        salary_tax_status
), prepared AS MATERIALIZED (
    SELECT
        aggregated_raw.*,
        salary_disclosed_count::numeric / publication_count AS salary_coverage,
        remote_count::numeric / publication_count AS remote_share,
        CASE
            WHEN midpoint_sample_size < :min_salary_sample THEN 'insufficient'
            WHEN midpoint_sample_size < (:min_salary_sample * 2)
              OR salary_disclosed_count::numeric / publication_count < 0.35 THEN 'low'
            WHEN midpoint_sample_size < (:min_salary_sample * 5)
              OR salary_disclosed_count::numeric / publication_count < 0.60 THEN 'medium'
            ELSE 'high'
        END AS confidence_level
    FROM aggregated_raw
), upserted AS (
    INSERT INTO observed_publication_metrics_daily (
        metric_date,
        source_id,
        profession_id,
        seniority_code,
        region_id,
        salary_tax_status,
        normalized_currency,
        publication_count,
        salary_disclosed_count,
        salary_coverage,
        midpoint_sample_size,
        salary_median,
        salary_average,
        salary_p25,
        salary_p75,
        lower_bound_median,
        upper_bound_median,
        confidence_level,
        remote_count,
        remote_share,
        last_ingested_at,
        transform_version,
        transform_run_id,
        created_at,
        updated_at
    )
    SELECT
        metric_date,
        source_id,
        profession_id,
        seniority_code,
        region_id,
        salary_tax_status,
        normalized_currency,
        publication_count,
        salary_disclosed_count,
        salary_coverage,
        midpoint_sample_size,
        CASE WHEN midpoint_sample_size >= :min_salary_sample THEN salary_median_raw END,
        CASE WHEN midpoint_sample_size >= :min_salary_sample THEN salary_average_raw END,
        CASE WHEN midpoint_sample_size >= :min_salary_sample THEN salary_p25_raw END,
        CASE WHEN midpoint_sample_size >= :min_salary_sample THEN salary_p75_raw END,
        CASE WHEN midpoint_sample_size >= :min_salary_sample THEN lower_bound_median_raw END,
        CASE WHEN midpoint_sample_size >= :min_salary_sample THEN upper_bound_median_raw END,
        confidence_level,
        remote_count,
        remote_share,
        last_ingested_at,
        :transform_version,
        :transform_run_id,
        now(),
        now()
    FROM prepared
    ON CONFLICT ON CONSTRAINT uq_observed_publication_metric_slice DO UPDATE SET
        publication_count = EXCLUDED.publication_count,
        salary_disclosed_count = EXCLUDED.salary_disclosed_count,
        salary_coverage = EXCLUDED.salary_coverage,
        midpoint_sample_size = EXCLUDED.midpoint_sample_size,
        salary_median = EXCLUDED.salary_median,
        salary_average = EXCLUDED.salary_average,
        salary_p25 = EXCLUDED.salary_p25,
        salary_p75 = EXCLUDED.salary_p75,
        lower_bound_median = EXCLUDED.lower_bound_median,
        upper_bound_median = EXCLUDED.upper_bound_median,
        confidence_level = EXCLUDED.confidence_level,
        remote_count = EXCLUDED.remote_count,
        remote_share = EXCLUDED.remote_share,
        last_ingested_at = EXCLUDED.last_ingested_at,
        transform_version = EXCLUDED.transform_version,
        transform_run_id = EXCLUDED.transform_run_id,
        updated_at = now()
    RETURNING
        publication_count,
        salary_disclosed_count,
        midpoint_sample_size
)
SELECT
    count(*)::integer AS slice_count,
    COALESCE(sum(publication_count), 0)::integer AS publication_count,
    COALESCE(sum(salary_disclosed_count), 0)::integer AS salary_disclosed_count,
    COALESCE(sum(midpoint_sample_size), 0)::integer AS midpoint_sample_size
FROM upserted;
