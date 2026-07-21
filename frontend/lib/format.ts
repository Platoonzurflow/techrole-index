export const rub = (value?: number) =>
  value == null
    ? "Недостаточно данных"
    : new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);

export const compact = (value: number) => new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const percent = (value: number) => new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 1 }).format(value);

