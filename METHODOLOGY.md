# Методология TechRole Index v1.0.0

## Salary

Срез: профессия × seniority × region × период × gross/net basis.

- salary coverage = вакансии с хотя бы одной границей / все вакансии;
- midpoint = `(from + to) / 2` только при двух границах;
- медиана, среднее, P25/P75 считаются по midpoint;
- медианы `from` и `to` считаются независимо по доступным границам;
- одна граница не используется для восстановления другой;
- gross/net/unknown не смешиваются;
- валюта нормализуется отдельным датированным `CurrencyRateProvider`, исходные значения сохраняются;
- при `n < MIN_SALARY_SAMPLE` (20 по умолчанию) midpoint-показатели не публикуются.

Confidence: `insufficient` при n ниже порога; `low` при n < 2×порог или coverage <35%; `medium` при n <5×порог или coverage <60%; иначе `high`.

### Официальный открытый зарплатный слой

Публикации «Работы России» не смешиваются с основной gross-витриной, потому что источник не задаёт совместимый gross/net-признак. Для каждого уровня Junior/Middle/Senior рассчитываются отдельные RUB-срезы за 180 дней. Median, average и P25/P75 публикуются только по midpoint полных вилок и только при `n ≥ 20`. Одиночные границы учитываются в salary coverage, но не превращаются в выдуманную полную вилку. История отображает скользящую 30-дневную медиану с недельным шагом; недостаточная выборка остаётся пропуском с явным статусом.

## Trends

Для N ∈ {7, 30, 90}: `Δ% = (avg(current N) - avg(previous N)) / avg(previous N) × 100`.

- up: > +3%;
- neutral: −3%…+3% включительно;
- down: < −3%;
- unknown: нет обоих окон или предыдущий average равен нулю.

## Score 0–100

Веса: demand 30%, salary 25%, demand growth 20%, junior access 10%, remote share 10%, data quality 5%.

Demand проходит `log1p`, salary/growth ограничиваются по 5/95 перцентилю. Эти три компонента переводятся в percentile rank среди активных профессий. Junior share насыщается при 35%, remote ограничивается 0…1. Data quality = `0.7 × coverage + 0.3 × min(sample/100, 1)`.

`Score = 100 × Σ(weight × component)`, результат ограничивается 0…100. Сохраняются version, breakdown и data confidence. Новые веса создают новую `scoring_versions` запись.

## Classification

Unicode/whitespace normalization → alias dictionary → regex → exclusion rules → experience → RU/EN seniority markers → confidence. Lead/principal/architect исключаются из автоматического Senior. Optional AI применяется только после низкой уверенности rule-based результата и получает верхний confidence 0.79.

## Ограничения

Вакансии не равны фактическим наймам; опубликованная вилка не равна офферу; coverage может быть смещён по профессии/региону/источнику. Основная воспроизводимая витрина пригодна для проверки продукта и не должна выдаваться за измерение рынка. Отдельный официальный слой показывает реальные классифицированные публикации с provenance, размером выборки и собственными ограничениями.
