import { describe, expect, setSystemTime, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertUniqueSlugs,
  findPublishedPost,
  PostValidationError,
  parsePost,
  publishedPosts,
  relatedPosts,
  unlinkUnpublished,
} from "./blog";

const dir = join(import.meta.dir, "../../../content/blog");
const posts = readdirSync(dir)
  .filter((file) => file.endsWith(".md"))
  .map((file) => parsePost(readFileSync(join(dir, file), "utf8"), file));

const sample = (frontmatter: string, body = "Hello") =>
  `---\n${frontmatter}\n---\n${body}`;
const validFrontmatter = `title: "A post"
description: "About things"
slug: a-post
publishAt: 2026-11-10T09:00:00Z
updatedAt: 2026-11-10T09:00:00Z
author: SDX Studio
tags: [one, two]
targetQuestion: "Why?"
keyword: things
faq:
  - q: "Q?"
    a: "A."`;

describe("blog content", () => {
  test("every committed post has valid, typed frontmatter and a unique slug", () => {
    expect(posts.length).toBe(12);
    expect(() => assertUniqueSlugs(posts)).not.toThrow();
    for (const post of posts) {
      expect(post.title.length).toBeLessThanOrEqual(60);
      expect(post.description.length).toBeLessThanOrEqual(155);
      expect(post.faq.length).toBeGreaterThan(0);
      expect(post.readingMinutes).toBeGreaterThan(0);
    }
  });

  test("verify comments never reach the rendered HTML", () => {
    const flagged = parsePost(
      sample(validFrontmatter, "<!-- verify: check this -->\n\nHello"),
      "flagged.md",
    );
    expect(flagged.html).not.toContain("verify:");
    for (const post of posts) {
      expect(post.html).not.toContain("verify:");
      expect(post.html).not.toContain("<!--");
    }
  });

  test("keeps the product link and soft CTA from the draft", () => {
    for (const post of posts) expect(post.html).toContain('href="/#offer"');
  });

  test("rejects bad frontmatter with the file name", () => {
    expect(() =>
      parsePost(
        sample(validFrontmatter.replace("slug: a-post", "slug: A Post")),
        "bad.md",
      ),
    ).toThrow(PostValidationError);
    expect(() =>
      parsePost(
        sample(validFrontmatter.replace(/faq:[\s\S]*/, "faq: []")),
        "bad.md",
      ),
    ).toThrow('bad.md: "faq"');
    expect(() =>
      parsePost(
        sample(
          validFrontmatter.replace(
            "updatedAt: 2026-11-10",
            "updatedAt: 2026-11-01",
          ),
        ),
        "bad.md",
      ),
    ).toThrow("updatedAt is before publishAt");
    expect(() => parsePost("no frontmatter", "bad.md")).toThrow(
      "missing frontmatter",
    );
  });
});

describe("scheduling (fake clock)", () => {
  const first = "reconcile-pax8-bill-against-psa-invoices"; // 10 Nov 2026 09:00Z
  const second = "what-is-license-leakage"; // 12 Nov 2026 09:00Z

  test("nothing is live before the first publish date", () => {
    expect(publishedPosts(posts, new Date("2026-11-02T12:00:00Z"))).toEqual([]);
    expect(
      findPublishedPost(posts, first, new Date("2026-11-10T08:59:59Z")),
    ).toBeNull();
  });

  test("a post goes live exactly at publishAt, newest first, future ones hidden", () => {
    const now = new Date("2026-11-12T09:00:00Z");
    expect(publishedPosts(posts, now).map((post) => post.slug)).toEqual([
      second,
      first,
    ]);
    expect(findPublishedPost(posts, second, now)?.slug).toBe(second);
    expect(
      findPublishedPost(posts, "seattrue-vs-gradient-reconcile", now),
    ).toBeNull();
  });

  test("uses the request-time clock, not build time", () => {
    setSystemTime(new Date("2026-12-31T00:00:00Z"));
    try {
      expect(publishedPosts(posts, new Date())).toHaveLength(12);
    } finally {
      setSystemTime();
    }
  });

  test("related posts are published only and never the post itself", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const post = findPublishedPost(posts, first, now);
    if (!post) throw new Error("expected post");
    const related = relatedPosts(post, posts, now);
    expect(related.length).toBeGreaterThan(0);
    for (const other of related) {
      expect(other.slug).not.toBe(first);
      expect(new Date(other.publishAt).getTime()).toBeLessThanOrEqual(
        now.getTime(),
      );
    }
  });
});

describe("verify flags hold a post back (fake clock)", () => {
  const now = new Date("2026-11-20T00:00:00Z"); // after the 10 Nov publishAt
  const flagged = parsePost(
    sample(validFrontmatter, "<!-- verify: confirm the figure -->\n\nHello"),
    "flagged.md",
  );
  const cleared = parsePost(sample(validFrontmatter, "Hello"), "cleared.md");

  test("a past-dated post that still has a verify flag stays hidden", () => {
    expect(flagged.unverified).toBe(true);
    expect(publishedPosts([flagged], now)).toEqual([]);
    expect(findPublishedPost([flagged], "a-post", now)).toBeNull();
    expect(relatedPosts(cleared, [flagged], now)).toEqual([]);
  });

  test("the same post with the flag removed is shown", () => {
    expect(cleared.unverified).toBe(false);
    expect(publishedPosts([cleared], now).map((post) => post.slug)).toEqual([
      "a-post",
    ]);
    expect(findPublishedPost([cleared], "a-post", now)?.slug).toBe("a-post");
  });

  test("a cleared post still waits for its date", () => {
    expect(publishedPosts([cleared], new Date("2026-11-10T08:59:59Z"))).toEqual(
      [],
    );
  });

  test("links to posts that aren't live render as plain text", () => {
    const post = parsePost(
      sample(
        validFrontmatter,
        "See [the held one](/blog/held-post) and [the live one](/blog/live-post).",
      ),
      "links.md",
    );
    const unlinked = unlinkUnpublished(post, new Set(["live-post"]));
    expect(unlinked.html).not.toContain('href="/blog/held-post"');
    expect(unlinked.html).toContain("the held one");
    expect(unlinked.html).toContain(
      '<a href="/blog/live-post">the live one</a>',
    );
    expect(unlinked.markdown).toBe(
      "See the held one and [the live one](/blog/live-post).",
    );
  });
});
