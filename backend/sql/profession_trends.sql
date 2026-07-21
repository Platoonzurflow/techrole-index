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
    100 * (demand_7d - demand_prev_7d) / NULLIF(demand_prev_7d, 0) AS demand_change_7d,
    100 * (salary_7d - salary_prev_7d) / NULLIF(salary_prev_7d, 0) AS salary_change_7d
FROM windows;

