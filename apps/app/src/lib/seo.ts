import { brand } from "@seattrue/ui";

/** Head for signed-in and account pages: titled, never indexed. */
export function privateHead(title: string) {
  return {
    meta: [
      { title: `${title} · ${brand.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
}
