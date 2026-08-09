-- Adjacent rolling windows; never compares a single day with the previous day.
WITH daily AS (
    SELECT metric_date, profession_id, sum(vacancy_count) AS vacancies,
           avg(salary_median) FILTER (WHERE salary_median IS NOT NULL) AS salary
    FROM profession_metrics_daily
    WHERE gross = true
    GROUP BY metric_date, profession_id
), windows AS (
    SELECT *,
        avg(vacancies) OVER (PARTITION BY profession_id ORDER BY metric_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS demand_7d,
        avg(vacancies) OVER (PARTITION BY profession_id ORDER BY metric_date ROWS BETWEEN 13 PRECEDING AND 7 PRECEDING) AS demand_prev_7d,
        avg(salary) OVER (PARTITION BY profession_id ORDER BY metric_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS salary_7d,
        avg(salary) OVER (PARTITION BY profession_id ORDER BY metric_date ROWS BETWEEN 13 PRECEDING AND 7 PRECEDING) AS salary_prev_7d
    FROM daily
)
SELECT *,
    CASE
        WHEN GREATEST(ABS(demand_7d), ABS(demand_prev_7d)) = 0 THEN 0
        ELSE GREATEST(-100, LEAST(100,
            100 * (demand_7d - demand_prev_7d)
                / NULLIF(GREATEST(ABS(demand_7d), ABS(demand_prev_7d)), 0)
        ))
    END AS demand_change_7d,
    CASE
        WHEN GREATEST(ABS(salary_7d), ABS(salary_prev_7d)) = 0 THEN 0
        ELSE GREATEST(-100, LEAST(100,
            100 * (salary_7d - salary_prev_7d)
                / NULLIF(GREATEST(ABS(salary_7d), ABS(salary_prev_7d)), 0)
        ))
    END AS salary_change_7d
FROM windows;

