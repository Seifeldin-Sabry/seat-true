export function httpOrigin(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);

  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }

  return url.origin;
}

/** Public origin of this app, which also serves the API under /api. */
export function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return httpOrigin(
    process.env.APP_ORIGIN || import.meta.env.VITE_APP_ORIGIN,
    "APP_ORIGIN",
  );
}
