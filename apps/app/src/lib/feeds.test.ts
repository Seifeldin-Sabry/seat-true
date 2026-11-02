import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePost, publishedPosts } from "./content/blog";
import { llmsFullTxt, llmsTxt, robotsTxt, rssXml, sitemapXml } from "./feeds";

const dir = join(import.meta.dir, "../../content/blog");
const all = readdirSync(dir)
  .filter((file) => file.endsWith(".md"))
  .map((file) => parsePost(readFileSync(join(dir, file), "utf8"), file));

const live = "reconcile-pax8-bill-against-psa-invoices"; // 10 Nov 2026
const future = "what-is-license-leakage"; // 12 Nov 2026
const fakeNow = new Date("2026-11-11T00:00:00Z");

describe("feeds respect the publish schedule (fake clock)", () => {
  const posts = publishedPosts(all, fakeNow);

  test("sitemap lists live posts with lastmod, never scheduled ones", () => {
    const xml = sitemapXml(posts);
    expect(xml).toContain(`/blog/${live}</loc>`);
    expect(xml).toContain("<lastmod>2026-11-10</lastmod>");
    expect(xml).not.toContain(future);
    expect(xml).toContain("<loc>https://seattrue.com/pricing</loc>");
    expect(xml).toContain("<loc>https://seattrue.com/for/small-msps</loc>");
    expect(xml).toContain(
      "<loc>https://seattrue.com/integrations/pax8-csv</loc>",
    );
    expect(xml).not.toContain("/app");
  });

  test("rss and llms files leave out scheduled posts", () => {
    for (const body of [rssXml(posts), llmsTxt(posts), llmsFullTxt(posts)]) {
      expect(body).toContain(live);
      expect(body).not.toContain(future);
    }
  });

  test("the same feed includes the post once its date passes, no rebuild", () => {
    const later = publishedPosts(all, new Date("2026-11-12T09:00:00Z"));
    expect(sitemapXml(later)).toContain(future);
    expect(rssXml(later)).toContain(future);
  });

  test("a past-dated post with a verify flag is left out of every feed", () => {
    const raw = readFileSync(join(dir, `${live}.md`), "utf8");
    const flagged = parsePost(
      raw.replace(/\n---\n/, "\n---\n<!-- verify: recheck -->\n"),
      `${live}.md`,
    );
    const held = publishedPosts([flagged], fakeNow);
    expect(held).toEqual([]);
    for (const body of [
      sitemapXml(held),
      rssXml(held),
      llmsTxt(held),
      llmsFullTxt(held),
    ]) {
      expect(body).not.toContain(live);
    }
    const shown = publishedPosts([parsePost(raw, `${live}.md`)], fakeNow);
    expect(sitemapXml(shown)).toContain(live);
  });

  test("llms.txt carries the product facts and real prices", () => {
    const text = llmsTxt([]);
    expect(text).toContain("$149/month");
    expect(text).toContain("$249/month");
    expect(text).toContain("Up to 150 active clients and 2 users");
    expect(text).toContain(
      "No refunds; cancel anytime and keep access until the end of the paid period.",
    );
    expect(llmsFullTxt(posts)).not.toContain("verify:");
  });

  test("robots allows the AI crawlers and blocks the app and API", () => {
    const robots = robotsTxt();
    for (const bot of [
      "GPTBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
    ]) {
      expect(robots).toContain(`User-agent: ${bot}\nAllow: /`);
    }
    expect(robots).toContain("Disallow: /app");
    expect(robots).toContain("Disallow: /api");
    expect(robots).toContain("Sitemap: https://seattrue.com/sitemap.xml");
  });
});
