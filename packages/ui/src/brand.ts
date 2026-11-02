/** Edit this file first when adapting the starter to a new product. */
export const brand = {
  name: "SeatTrue",
  tagline: "Find the license leak before the invoice goes out.",
  themeColor: "#f8f4ec",
  /** Public marketing domain: canonical URLs, sitemap, feeds, structured data. Set SITE_URL at build time. */
  siteUrl: (import.meta.env.SITE_URL || "https://seattrue.com").replace(
    /\/$/,
    "",
  ),
  appUrl: import.meta.env.VITE_APP_ORIGIN || "http://localhost:3000",
  webUrl: import.meta.env.VITE_WEB_ORIGIN || "http://localhost:3000",
} as const;
