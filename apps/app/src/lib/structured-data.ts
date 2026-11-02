import { brand } from "@seattrue/ui";
import type { FaqItem, PostMeta } from "./content/blog";
import { absoluteUrl, plans } from "./site";

/**
 * schema.org JSON-LD builders. Facts only: no ratings, reviews or invented
 * numbers. Required properties per type are checked in structured-data.test.ts.
 */
type JsonLd = Record<string, unknown>;

const organizationId = `${brand.siteUrl}/#organization`;
const websiteId = `${brand.siteUrl}/#website`;

export function organization(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: brand.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.png"),
    description:
      "Microsoft 365 license reconciliation for MSPs, built by SDX Studio.",
  };
}

export function website(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    name: brand.name,
    url: absoluteUrl("/"),
    publisher: { "@id": organizationId },
    inLanguage: "en",
  };
}

export function softwareApplication(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/"),
    description:
      "Checks every Microsoft 365 line on an MSP's Pax8 bill against what each client is invoiced, at cost × the agreed markup.",
    publisher: { "@id": organizationId },
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      description: plan.summary,
      price: plan.priceUsd.toFixed(2),
      priceCurrency: "USD",
      url: absoluteUrl("/pricing"),
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: plan.priceUsd.toFixed(2),
        priceCurrency: "USD",
        unitCode: "MON",
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: 1,
          unitCode: "MON",
        },
      },
    })),
  };
}

export function faqPage(faq: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function article(post: PostMeta, image: string): JsonLd {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: [image],
    datePublished: post.publishAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@id": organizationId },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    keywords: post.tags.join(", "),
    inLanguage: "en",
  };
}

export function definedTermSet(
  terms: { slug: string; term: string; definition: string }[],
): JsonLd {
  const url = absoluteUrl("/glossary");
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${url}#terms`,
    name: "Microsoft 365 billing glossary for MSPs",
    url,
    hasDefinedTerm: terms.map((entry) => ({
      "@type": "DefinedTerm",
      "@id": `${url}#${entry.slug}`,
      name: entry.term,
      description: entry.definition,
      inDefinedTermSet: `${url}#terms`,
      url: `${url}#${entry.slug}`,
    })),
  };
}

export function itemList(
  name: string,
  items: { name: string; path: string; description: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      description: item.description,
      item: absoluteUrl(item.path),
    })),
  };
}

/** `</script>` inside JSON would end the tag early; escape every `<`. */
export function jsonLdScript(data: JsonLd) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
