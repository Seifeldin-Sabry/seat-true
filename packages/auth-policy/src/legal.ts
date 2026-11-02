/**
 * Operator facts for the privacy policy, terms, DPA, footer and sign-up.
 * Bracketed values are placeholders still to be confirmed: edit them here
 * and every page follows. Belgian law (Code of Economic Law, art. XII.6)
 * requires the geographic address on the site.
 */
export const legal = {
  operator: "SDX Studio",
  enterpriseNumber: "BE 1035.554.875",
  country: "Belgium",
  address: "[REGISTERED OFFICE ADDRESS]",
  email: "[CONTACT EMAIL]",
  lastUpdated: "2 November 2026",
  /** Stored on each new workspace at sign-up. Change it when the Terms or DPA change materially. */
  termsVersion: "2026-11-02",
} as const;
