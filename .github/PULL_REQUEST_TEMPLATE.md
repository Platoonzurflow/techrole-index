## Что изменено

Кратко опишите проблему и результат.

## Проверки

- [ ] Backend: Ruff, mypy, pytest
- [ ] Frontend: ESLint, TypeScript, Vitest, production build
- [ ] Compose config
- [ ] E2E/public audit, если менялись публичные страницы или machine endpoints
- [ ] Free JSON/HTML не содержит Premium-полей, если менялся доступ
- [ ] Gitleaks не обнаруживает секретов

## Данные и решения

- [ ] Для нового источника приложены официальные условия/API и provenance
- [ ] Gross/net/unknown и минимальная выборка не смешаны
- [ ] Важное предположение добавлено в `DECISIONS.md`
- [ ] В diff нет `.env`, dump, персональных данных и постороннего форматирования
