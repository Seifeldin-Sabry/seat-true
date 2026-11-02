import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePost } from "./content/blog";
import { glossary } from "./content/glossary";
import { sitePages } from "./site";
import {
  article,
  breadcrumbs,
  definedTermSet,
  faqPage,
  jsonLdScript,
  organization,
  softwareApplication,
  website,
} from "./structured-data";

type Node = Record<string, unknown>;

/** Required (or Google-required) properties per schema.org type we emit. */
const required: Record<string, string[]> = {
  Organization: ["name"],
  WebSite: ["name", "url"],
  SoftwareApplication: [
    "name",
    "applicationCategory",
    "operatingSystem",
    "offers",
  ],
  Offer: ["price", "priceCurrency"],
  FAQPage: ["mainEntity"],
  Question: ["name", "acceptedAnswer"],
  Answer: ["text"],
  BreadcrumbList: ["itemListElement"],
  ListItem: ["position", "name", "item"],
  BlogPosting: [
    "headline",
    "image",
    "datePublished",
    "dateModified",
    "author",
    "publisher",
  ],
  DefinedTermSet: ["name", "hasDefinedTerm"],
  DefinedTerm: ["name", "description"],
};

function checkNode(node: Node, path: string) {
  const type = node["@type"];
  if (typeof type === "string") {
    for (const key of required[type] ?? []) {
      const value = node[key];
      expect({
        path,
        type,
        key,
        present: value !== undefined && value !== "",
      }).toEqual({
        path,
        type,
        key,
        present: true,
      });
    }
    // Facts only: never self-awarded ratings or reviews.
    expect(node.aggregateRating).toBeUndefined();
    expect(node.review).toBeUndefined();
  }
  for (const [key, value] of Object.entries(node)) {
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (child && typeof child === "object")
        checkNode(child as Node, `${path}.${key}`);
    }
  }
}

const post = parsePost(
  readFileSync(
    join(import.meta.dir, "../../content/blog/what-is-license-leakage.md"),
    "utf8",
  ),
  "what-is-license-leakage.md",
);

describe("JSON-LD", () => {
  const docs: [string, Node][] = [
    ["organization", organization()],
    ["website", website()],
    ["software", softwareApplication()],
    ["faq", faqPage(post.faq)],
    [
      "breadcrumbs",
      breadcrumbs([
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
      ]),
    ],
    ["article", article(post, "https://seattrue.com/og/blog/x.png")],
    ["glossary", definedTermSet(glossary)],
  ];

  for (const [name, doc] of docs) {
    test(`${name} has schema.org context and required properties`, () => {
      expect(doc["@context"]).toBe("https://schema.org");
      checkNode(doc, name);
    });
  }

  test("the site organization has a url and logo", () => {
    expect(organization().url).toBe("https://seattrue.com/");
    expect(organization().logo).toBe("https://seattrue.com/logo.png");
  });

  test("offers use the real plan prices in USD", () => {
    const offers = softwareApplication().offers as Node[];
    expect(
      offers.map((offer) => [offer.name, offer.price, offer.priceCurrency]),
    ).toEqual([
      ["Solo", "149.00", "USD"],
      ["Team", "249.00", "USD"],
    ]);
  });

  test("article carries dateModified from frontmatter", () => {
    expect(article(post, "x").dateModified).toBe(post.updatedAt);
  });

  test("script output can't close its own tag", () => {
    const script = jsonLdScript(faqPage([{ q: "</script><b>", a: "a" }]));
    expect(script.children).not.toContain("</script>");
    expect(JSON.parse(script.children).mainEntity[0].name).toBe("</script><b>");
  });
});

describe("site pages", () => {
  test("titles ≤ 60 and descriptions ≤ 155 characters, all unique", () => {
    const pages = Object.values(sitePages);
    for (const page of pages) {
      expect({ path: page.path, ok: page.title.length <= 60 }).toEqual({
        path: page.path,
        ok: true,
      });
      expect({ path: page.path, ok: page.description.length <= 155 }).toEqual({
        path: page.path,
        ok: true,
      });
    }
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.primaryKeyword)).size).toBe(
      pages.length,
    );
  });
});
