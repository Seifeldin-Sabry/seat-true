import { describe, expect, test } from "bun:test";
import freeEmailDomains from "free-email-domains";
import { emailDomain, emailMatchesDomain, isWorkEmail } from "./index";

describe("isWorkEmail", () => {
  test.each([
    "a@gmail.com",
    "a@googlemail.com",
    "a@outlook.com",
    "a@hotmail.co.uk",
    "a@live.com",
    "a@yahoo.com",
    "a@icloud.com",
    "a@me.com",
    "a@aol.com",
    "a@proton.me",
    "a@protonmail.com",
    "a@gmx.com",
    "a@yandex.com",
    "a@zoho.com",
    "a@mail.com",
    "a@hey.com",
    "A@GMAIL.COM",
    "a@mail.yahoo.co.uk",
  ])("rejects personal mailbox %s", (email) => {
    expect(isWorkEmail(email)).toBe(false);
  });

  test.each([
    "seif@sdxstudio.com",
    "ops@northbeam-it.co.uk",
    "billing@acme.io",
    "finance@it.example.com",
  ])("accepts company mailbox %s", (email) => {
    expect(isWorkEmail(email)).toBe(true);
  });

  test("rejects malformed addresses", () => {
    for (const email of ["", "nobody", "@acme.com", "a@", "a@localhost"]) {
      expect(isWorkEmail(email)).toBe(false);
    }
  });

  test("upstream list holds no bare public suffixes that would block companies", () => {
    for (const suffix of ["com", "co.uk", "io", "org.uk", "com.au"]) {
      expect(freeEmailDomains.includes(suffix)).toBe(false);
    }
  });
});

describe("emailMatchesDomain", () => {
  test("matches the company domain and its subdomains only", () => {
    expect(emailMatchesDomain("ann@acme.com", "acme.com")).toBe(true);
    expect(emailMatchesDomain("ann@uk.acme.com", "@ACME.com")).toBe(true);
    expect(emailMatchesDomain("ann@notacme.com", "acme.com")).toBe(false);
    expect(emailMatchesDomain("ann@acme.com.evil.io", "acme.com")).toBe(false);
  });

  test("normalizes case and trailing dots", () => {
    expect(emailDomain("Ann@Acme.COM.")).toBe("acme.com");
  });
});
