import { expect, test } from "bun:test";
import { createDatabase, user } from "@seattrue/db";
import { eq } from "drizzle-orm";
import { createAuthService } from "./auth";

const databaseUrl = process.env.TEST_DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;
const integrationTest = databaseUrl && authSecret ? test : test.skip;
const appOrigin = "http://localhost:3000";

integrationTest(
  "email sign-up rejects personal mailboxes and accepts work email",
  async () => {
    if (!databaseUrl || !authSecret) return;
    const connection = createDatabase(databaseUrl);
    const auth = createAuthService(connection.db, {
      baseURL: appOrigin,
      secret: authSecret,
      trustedOrigins: [appOrigin],
      // Fresh address per test run keeps Better Auth rate limits out of the way.
      getClientIp: () =>
        `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    });
    const signUp = (email: string) =>
      auth.handler(
        new Request(`${appOrigin}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { Origin: appOrigin, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Ann",
            email,
            password: `Password-${crypto.randomUUID()}`,
          }),
        }),
      );
    const personal = `${crypto.randomUUID()}@gmail.com`;
    const work = `${crypto.randomUUID()}@northbeam-it.com`;

    try {
      const rejected = await signUp(personal);
      expect(rejected.status).toBe(400);
      expect((await rejected.json()).message).toBe(
        "Use your work email. Gmail and Outlook addresses aren't accepted.",
      );
      const [stored] = await connection.db
        .select()
        .from(user)
        .where(eq(user.email, personal));
      expect(stored).toBeUndefined();

      expect((await signUp(work)).status).toBe(200);
    } finally {
      await connection.db.delete(user).where(eq(user.email, work));
      await connection.close();
    }
  },
);
