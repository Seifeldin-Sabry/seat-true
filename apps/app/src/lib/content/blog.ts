import { Marked } from "marked";
import { parse as parseYaml } from "yaml";

/**
 * Blog posts are markdown files in apps/app/content/blog. Everything here is
 * pure (no file system, no clock) so the scheduling rules are testable with a
 * fake `now`. Server code passes `new Date()` at request time.
 */

export type FaqItem = { q: string; a: string };

export type PostMeta = {
  title: string;
  description: string;
  slug: string;
  publishAt: string;
  updatedAt: string;
  author: string;
  tags: string[];
  targetQuestion: string;
  keyword: string;
  faq: FaqItem[];
};

export type Post = PostMeta & {
  html: string;
  /** Body markdown without editorial comments, for llms-full.txt. */
  markdown: string;
  /** Plain text of the body, for reading time and glossary matching. */
  text: string;
  readingMinutes: number;
  /** Source still has a `<!-- verify` fact flag: held back whatever the date. */
  unverified: boolean;
};

/** Card data for lists: no body. */
export type PostSummary = Omit<Post, "html" | "markdown" | "text">;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const verifyComment = /<!--\s*verify:[\s\S]*?-->\s*/g;
const verifyFlag = /<!--\s*verify/;

export class PostValidationError extends Error {}

function requireString(
  data: Record<string, unknown>,
  key: string,
  file: string,
  maxLength?: number,
): string {
  const value = data[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new PostValidationError(
      `${file}: "${key}" must be a non-empty string`,
    );
  }
  if (maxLength && value.length > maxLength) {
    throw new PostValidationError(
      `${file}: "${key}" is ${value.length} characters, max ${maxLength}`,
    );
  }
  return value.trim();
}

function requireIsoDate(
  data: Record<string, unknown>,
  key: string,
  file: string,
): string {
  const raw = data[key];
  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (raw === undefined || Number.isNaN(date.getTime())) {
    throw new PostValidationError(`${file}: "${key}" must be an ISO date`);
  }
  return date.toISOString();
}

export function validateMeta(data: unknown, file: string): PostMeta {
  if (!data || typeof data !== "object") {
    throw new PostValidationError(`${file}: missing frontmatter`);
  }
  const record = data as Record<string, unknown>;
  const slug = requireString(record, "slug", file);
  if (!slugPattern.test(slug)) {
    throw new PostValidationError(`${file}: slug "${slug}" must be kebab-case`);
  }
  const publishAt = requireIsoDate(record, "publishAt", file);
  const updatedAt = requireIsoDate(record, "updatedAt", file);
  if (updatedAt < publishAt) {
    throw new PostValidationError(`${file}: updatedAt is before publishAt`);
  }
  const tags = record.tags;
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    !tags.every((tag) => typeof tag === "string" && tag.trim())
  ) {
    throw new PostValidationError(`${file}: "tags" must be a list of strings`);
  }
  const faq = record.faq;
  if (
    !Array.isArray(faq) ||
    faq.length === 0 ||
    !faq.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.q === "string" &&
        item.q.trim() &&
        typeof item.a === "string" &&
        item.a.trim(),
    )
  ) {
    throw new PostValidationError(
      `${file}: "faq" must be a list of { q, a } strings`,
    );
  }
  return {
    title: requireString(record, "title", file, 60),
    description: requireString(record, "description", file, 155),
    slug,
    publishAt,
    updatedAt,
    author: requireString(record, "author", file),
    tags: tags.map((tag: string) => tag.trim()),
    targetQuestion: requireString(record, "targetQuestion", file),
    keyword: requireString(record, "keyword", file),
    faq: faq.map((item: FaqItem) => ({ q: item.q.trim(), a: item.a.trim() })),
  };
}

const markdown = new Marked({ gfm: true, async: false });

export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

/** Parses one markdown file. `file` is only used in error messages. */
export function parsePost(raw: string, file: string): Post {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) throw new PostValidationError(`${file}: missing frontmatter`);
  const meta = validateMeta(parseYaml(match[1] ?? ""), file);
  // Editorial verify notes stay in the source file, never in the page.
  const body = (match[2] ?? "").replace(verifyComment, "");
  const html = markdown.parse(body) as string;
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|]+/g, " ")
    .replace(/(^|\s)-+(?=\s)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    ...meta,
    html,
    markdown: body.trim(),
    text,
    readingMinutes: readingMinutes(text),
    unverified: verifyFlag.test(raw),
  };
}

/** Live once its date has passed and no fact flag is left in the source. */
export function isPublished(
  post: Pick<Post, "publishAt" | "unverified">,
  now: Date,
) {
  return (
    !post.unverified && new Date(post.publishAt).getTime() <= now.getTime()
  );
}

/** Published posts, newest first. Future and unverified posts don't exist yet. */
export function publishedPosts<T extends Post>(posts: T[], now: Date): T[] {
  return posts
    .filter((post) => isPublished(post, now))
    .sort((a, b) => b.publishAt.localeCompare(a.publishAt));
}

export function findPublishedPost<T extends Post>(
  posts: T[],
  slug: string,
  now: Date,
): T | null {
  return (
    posts.find((post) => post.slug === slug && isPublished(post, now)) ?? null
  );
}

/** Published posts sharing the most tags with `post` (ties: newest first). */
export function relatedPosts<T extends Post>(
  post: PostMeta,
  posts: T[],
  now: Date,
  limit = 3,
): T[] {
  const tags = new Set(post.tags);
  return publishedPosts(posts, now)
    .filter((other) => other.slug !== post.slug)
    .map((other) => ({
      other,
      shared: other.tags.filter((tag) => tags.has(tag)).length,
    }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(({ other }) => other);
}

/**
 * Series links point at earlier posts, but an earlier post can be held by a
 * fact flag. Links to posts that aren't live become plain text, so a
 * published post never links to a 404.
 */
export function unlinkUnpublished<T extends Post>(
  post: T,
  liveSlugs: ReadonlySet<string>,
): T {
  const isLive = (slug: string) => liveSlugs.has(slug);
  return {
    ...post,
    html: post.html.replace(
      /<a href="\/blog\/([a-z0-9-]+)[^"]*">([\s\S]*?)<\/a>/g,
      (link, slug: string, label: string) => (isLive(slug) ? link : label),
    ),
    markdown: post.markdown.replace(
      /\[([^\]]+)\]\(\/blog\/([a-z0-9-]+)[^)]*\)/g,
      (link, label: string, slug: string) => (isLive(slug) ? link : label),
    ),
  };
}

export function toSummary(post: Post): PostSummary {
  const { html: _html, markdown: _markdown, text: _text, ...summary } = post;
  return summary;
}

/** Throws on duplicate slugs so a copy-paste mistake fails the build, not a page. */
export function assertUniqueSlugs(posts: PostMeta[]) {
  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new PostValidationError(`duplicate slug "${post.slug}"`);
    }
    seen.add(post.slug);
  }
}
