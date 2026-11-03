import { expect, test } from "bun:test";
import type { BetterAuthSecondaryStorage } from "@seattrue/cache";
import { createDatabase } from "@seattrue/db";
import { createEmailService } from "@seattrue/email";
import { createAuth, requireWorkEmail } from "./auth";

// The MCP/OAuth provider plugins read their tables when Better Auth starts,
// so these tests use the local test database and wait for startup to finish.
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://starter:starter@localhost:5432/starter";
const starting: Promise<unknown>[] = [];
function makeAuth(...args: Parameters<typeof createAuth>) {
  const auth = createAuth(...args);
  starting.push(auth.$context.catch(() => {}));
  return auth;
}
const baseEnvironment = {
  baseURL: "https://app.example.com",
  secret: "test-secret-with-at-least-32-characters",
  trustedOrigins: ["https://app.example.com"],
};

test("optional secondary storage changes rate limits while sessions remain in PostgreSQL", async () => {
  const connection = createDatabase(databaseUrl);
  const values = new Map<string, string>();
  const secondaryStorage: BetterAuthSecondaryStorage = {
    get: async (key) => values.get(key) ?? null,
    getAndDelete: async (key) => {
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    },
    set: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
    increment: async (key) => {
      const next = Number(values.get(key) ?? 0) + 1;
      values.set(key, String(next));
      return next;
    },
  };

  try {
    const postgresOnly = makeAuth(connection.db, baseEnvironment);
    expect(postgresOnly.options.rateLimit?.storage).toBe("database");

    const withCache = makeAuth(connection.db, {
      ...baseEnvironment,
      secondaryStorage,
    });
    expect(withCache.options.secondaryStorage).toBe(secondaryStorage);
    expect(withCache.options.rateLimit?.storage).toBe("secondary-storage");
    expect(withCache.options.session?.storeSessionInDatabase).toBe(true);
  } finally {
    await Promise.all(starting.splice(0));
    await connection.close();
  }
});

test("enables verification and reset callbacks only with configured email", async () => {
  const connection = createDatabase(databaseUrl);
  const sent: { to: string; subject: string }[] = [];
  const email = createEmailService({
    env: {
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "SeatTrue <mail@example.com>",
    },
    sender: async (message) => {
      sent.push({ to: message.to, subject: message.subject });
      return { data: { id: "email-test-id" }, error: null };
    },
  });
  try {
    const withoutEmail = makeAuth(connection.db, {
      ...baseEnvironment,
      email: createEmailService({ env: {} }),
    });
    expect(
      withoutEmail.options.emailAndPassword?.requireEmailVerification,
    ).toBeUndefined();
    expect(withoutEmail.options.emailVerification).toBeUndefined();

    const configured = makeAuth(connection.db, { ...baseEnvironment, email });
    expect(configured.options.emailAndPassword?.requireEmailVerification).toBe(
      true,
    );
    expect(configured.options.emailVerification?.sendOnSignUp).toBe(true);
    expect(configured.options.emailVerification?.sendOnSignIn).toBe(true);

    const verification =
      configured.options.emailVerification?.sendVerificationEmail;
    const reset = configured.options.emailAndPassword?.sendResetPassword;
    if (!verification || !reset)
      throw new Error("Email callbacks not installed");
    const user = {
      id: "user-test",
      name: "Test User",
      email: "person@example.com",
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await verification({
      user,
      url: "https://api.example.com/api/auth/verify-email?token=secret",
    });
    await reset({
      user,
      url: "https://app.example.com/reset-password?token=secret",
    });
    await Bun.sleep(5);
    expect(sent).toEqual([
      { to: user.email, subject: "Verify your email for SeatTrue" },
      { to: user.email, subject: "Reset your SeatTrue password" },
    ]);
  } finally {
    await Promise.all(starting.splice(0));
    await connection.close();
  }
});

test("propagates email delivery failure without exposing provider details", async () => {
  const connection = createDatabase(databaseUrl);
  const errors: Record<string, unknown>[] = [];
  const email = createEmailService({
    env: { RESEND_API_KEY: "re_test", EMAIL_FROM: "mail@example.com" },
    sender: async () => ({
      data: null,
      error: { message: "provider token is private" },
    }),
  });
  try {
    const auth = makeAuth(connection.db, {
      ...baseEnvironment,
      email,
      logger: { info() {}, warn() {}, error: (entry) => errors.push(entry) },
    });
    const verification = auth.options.emailVerification?.sendVerificationEmail;
    if (!verification) throw new Error("Verification callback not installed");
    await expect(
      verification({
        user: { email: "person@example.com", name: "Test" },
        url: "https://api.example.com/api/auth/verify-email?token=secret",
      }),
    ).rejects.toThrow("Email delivery failed");
    expect(errors[0]?.event).toBe("verification_email_failed");
    expect(JSON.stringify(errors)).not.toContain("provider token is private");
  } finally {
    await Promise.all(starting.splice(0));
    await connection.close();
  }
});

test("user-create hook rejects personal mailboxes for email and Google sign-ups", async () => {
  // The same hook runs for email sign-up and for a first Google sign-in, so
  // a Google profile with a consumer address is rejected identically.
  for (const email of ["ann@gmail.com", "ann@outlook.com", "ann@proton.me"]) {
    await expect(
      requireWorkEmail({ email, name: "Ann", emailVerified: true }),
    ).rejects.toMatchObject({
      body: {
        code: "WORK_EMAIL_REQUIRED",
        message:
          "Use your work email. Gmail and Outlook addresses aren't accepted.",
      },
    });
  }
  const allowed = { email: "ann@northbeam-it.com", name: "Ann" };
  expect(await requireWorkEmail(allowed)).toEqual({ data: allowed });
});

test("Google provider is configured only when credentials are present", async () => {
  const connection = createDatabase(databaseUrl);
  try {
    const without = makeAuth(connection.db, baseEnvironment);
    expect(without.options.socialProviders).toBeUndefined();
    expect(without.options.databaseHooks?.user?.create?.before).toBeDefined();

    const withGoogle = makeAuth(connection.db, {
      ...baseEnvironment,
      google: { clientId: "id.apps.googleusercontent.com", clientSecret: "x" },
    });
    expect(withGoogle.options.socialProviders?.google).toMatchObject({
      hd: "*",
      prompt: "select_account",
    });
  } finally {
    await Promise.all(starting.splice(0));
    await connection.close();
  }
});
