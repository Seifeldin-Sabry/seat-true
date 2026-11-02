import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toSummary } from "./blog";
import { glossaryEntriesIn } from "./glossary";
import { livePost, livePosts, nextPublishAt } from "./posts.server";

/** Server-only: the markdown, parser and schedule check never reach the browser. */
export const getBlogIndex = createServerFn({ method: "GET" }).handler(() => ({
  posts: livePosts().map(toSummary),
  nextPublishAt: nextPublishAt(),
}));

export const getBlogPost = createServerFn({ method: "GET" })
  .inputValidator((slug: unknown) => {
    if (typeof slug !== "string") throw new Error("slug must be a string");
    return slug;
  })
  .handler(({ data: slug }) => {
    const found = livePost(slug);
    if (!found) throw notFound();
    const { text, markdown: _markdown, ...post } = found.post;
    const glossary = glossaryEntriesIn(`${text} ${post.tags.join(" ")}`).map(
      (entry) => ({ slug: entry.slug, term: entry.term }),
    );
    return { post, related: found.related, glossary };
  });
