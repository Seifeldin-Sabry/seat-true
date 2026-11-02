import {
  assertUniqueSlugs,
  findPublishedPost,
  type Post,
  parsePost,
  publishedPosts,
  relatedPosts,
  toSummary,
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
  return publishedPosts(allPosts, now);
}

export function livePost(slug: string, now = new Date()) {
  const post = findPublishedPost(allPosts, slug, now);
  if (!post) return null;
  return {
    post,
    related: relatedPosts(post, allPosts, now).map(toSummary),
  };
}

/** When the next scheduled post goes live (date only, never its title). */
export function nextPublishAt(now = new Date()): string | null {
  const upcoming = allPosts
    .map((post) => post.publishAt)
    .filter((publishAt) => new Date(publishAt).getTime() > now.getTime())
    .sort();
  return upcoming[0] ?? null;
}
