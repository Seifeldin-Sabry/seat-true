import {
  assertUniqueSlugs,
  type Post,
  parsePost,
  publishedPosts,
  relatedPosts,
  toSummary,
  unlinkUnpublished,
} from "./blog";

/**
 * Every post, including scheduled ones, bundled into the server build.
 * Visibility is decided per request from the clock, so a scheduled post goes
 * live at its publishAt without a rebuild or deploy.
 */
const files = import.meta.glob<string>("../../../content/blog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const allPosts: Post[] = Object.entries(files).map(([path, raw]) =>
  parsePost(raw, path.split("/").pop() ?? path),
);
assertUniqueSlugs(allPosts);

export function livePosts(now = new Date()) {
  const live = publishedPosts(allPosts, now);
  const liveSlugs = new Set(live.map((post) => post.slug));
  return live.map((post) => unlinkUnpublished(post, liveSlugs));
}

export function livePost(slug: string, now = new Date()) {
  const post = livePosts(now).find((live) => live.slug === slug);
  if (!post) return null;
  return {
    post,
    related: relatedPosts(post, allPosts, now).map(toSummary),
  };
}

/** When the next scheduled post goes live (date only, never its title). Held posts have no date yet. */
export function nextPublishAt(now = new Date()): string | null {
  const upcoming = allPosts
    .filter((post) => !post.unverified)
    .map((post) => post.publishAt)
    .filter((publishAt) => new Date(publishAt).getTime() > now.getTime())
    .sort();
  return upcoming[0] ?? null;
}
