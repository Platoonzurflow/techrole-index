export const legal = {
  sellerName: process.env.SELLER_NAME || "Самозанятый исполнитель",
  sellerInn: process.env.SELLER_INN || "Реквизиты указаны в платёжном чеке",
  sellerPhone: process.env.SELLER_PHONE || "Контакт через email",
  sellerAddress: process.env.SELLER_ADDRESS || "Российская Федерация",
  sellerEmail: process.env.SELLER_EMAIL || "sqldevelopermoscow@yandex.com",
  effectiveDate: process.env.LEGAL_EFFECTIVE_DATE || "22 июля 2026 года",
} as const;
