import freeEmailDomains from "free-email-domains";

/** Shown wherever a personal mailbox is rejected (API errors and auth screens). */
export const WORK_EMAIL_REQUIRED_MESSAGE = "Please use your work email";

/** Consumer providers missing from the upstream list. */
const extraFreeDomains = ["hey.com"];

const freeDomains = new Set<string>([...freeEmailDomains, ...extraFreeDomains]);

/** Lower-cased domain after the last "@", or null when the address has none. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

/**
 * True for company mailboxes. Rejects free and disposable providers, including
 * their subdomains (mail.yahoo.co.uk), using the daily-validated
 * free-email-domains list.
 */
export function isWorkEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain?.includes(".")) return false;
  const labels = domain.split(".");
  // Check the domain and each parent with at least two labels.
  for (let start = 0; start <= labels.length - 2; start++) {
    if (freeDomains.has(labels.slice(start).join("."))) return false;
  }
  return true;
}

/** True when the email belongs to exactly this company domain or a subdomain of it. */
export function emailMatchesDomain(
  email: string,
  companyDomain: string,
): boolean {
  const domain = emailDomain(email);
  const expected = companyDomain.trim().toLowerCase().replace(/^@/, "");
  if (!domain || !expected) return false;
  return domain === expected || domain.endsWith(`.${expected}`);
}
