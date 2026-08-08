type MarketPeriod = {
  date_from: string;
  date_to: string;
  observed_date_from?: string;
  observed_date_to?: string;
  daily_publications?: Array<{ date: string; count: number }>;
};

export function observedPublicationPeriod(data: MarketPeriod) {
  const dates = (data.daily_publications ?? [])
    .filter((item) => item.count > 0)
    .map((item) => item.date)
    .sort();
  return {
    dateFrom: data.observed_date_from ?? dates[0] ?? data.date_from,
    dateTo: data.observed_date_to ?? dates.at(-1) ?? data.date_to,
  };
}
