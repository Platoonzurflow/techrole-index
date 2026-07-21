interface LinkTarget {
  href: string;
  type?: string;
}

export interface DatasetLinkContext {
  anchor: string;
  "cite-as"?: LinkTarget[];
  collection?: LinkTarget[];
  describedby?: LinkTarget[];
  item?: LinkTarget[];
}

export interface DatasetLinkset {
  linkset: DatasetLinkContext[];
}

export function buildDatasetLinkset(siteUrl: string): DatasetLinkset {
  const base = siteUrl.replace(/\/$/, "");
  const landing = `${base}/open-data-daily`;
  const dailyJson = `${base}/open-data-daily.json`;
  const dailyCsv = `${base}/open-data-daily.csv`;
  const linkset = `${base}/.well-known/linkset.json`;
  const sharedDescriptions: LinkTarget[] = [
    { href: `${base}/open-data-daily.schema.json`, type: "application/schema+json" },
    { href: `${base}/open-data-daily.croissant.json`, type: "application/ld+json" },
    { href: `${base}/open-data-daily.csv-metadata.json`, type: "application/csvm+json" },
    { href: `${base}/catalog.jsonld`, type: "application/ld+json" },
    { href: `${base}/datapackage.json`, type: "application/json" },
    { href: `${base}/citation.json`, type: "application/vnd.citationstyles.csl+json" },
    { href: `${base}/data-status.json`, type: "application/json" },
  ];

  return {
    linkset: [
      {
        anchor: landing,
        "cite-as": [{ href: landing, type: "text/html" }],
        item: [
          { href: dailyJson, type: "application/json" },
          { href: dailyCsv, type: "text/csv" },
        ],
        describedby: sharedDescriptions,
      },
      {
        anchor: dailyJson,
        collection: [{ href: landing, type: "text/html" }],
        describedby: [
          { href: `${base}/open-data-daily.schema.json`, type: "application/schema+json" },
          { href: `${base}/open-data-daily.croissant.json`, type: "application/ld+json" },
        ],
      },
      {
        anchor: dailyCsv,
        collection: [{ href: landing, type: "text/html" }],
        describedby: [
          { href: `${base}/open-data-daily.csv-metadata.json`, type: "application/csvm+json" },
          { href: `${base}/open-data-daily.croissant.json`, type: "application/ld+json" },
        ],
      },
      {
        anchor: linkset,
        collection: [{ href: landing, type: "text/html" }],
      },
    ],
  };
}
