const longDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
});

/** UTC so the server render and the hydrated page always agree. */
export function formatPostDate(iso: string): string {
  return longDate.format(new Date(iso));
}
