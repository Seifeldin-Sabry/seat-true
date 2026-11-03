import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export { account, rateLimit, session, user, verification } from "./auth-schema";
export {
  billingCustomers,
  billingPlanChanges,
  billingPurchases,
  billingSubscriptions,
  billingWebhookEvents,
} from "./billing-schema";
export {
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
} from "./oauth-schema";
export {
  auditLog,
  invitation,
  member,
  organization,
  type WorkspaceRole,
} from "./org-schema";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("projects_owner_id_idx").on(table.ownerId)],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export {
  agreementLines,
  auditRequests,
  billingImports,
  clients,
  customerMappings,
  type ExceptionStatus,
  exceptionComments,
  integrationWaitlist,
  reconciliationExceptions,
  reconciliationRuns,
  type StoredBilledLine,
  type StoredVendorLine,
  skuAliases,
  waitlistEntries,
} from "./recon-schema";
