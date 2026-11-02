import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export type AccountEmail = {
  to: string;
  name?: string;
  url: string;
};

export type EmailSender = (
  message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  },
  options?: { idempotencyKey: string },
) => Promise<{
  data: { id: string } | null;
  error: { message: string } | null;
}>;

export type InvitationEmail = {
  to: string;
  url: string;
  organizationName: string;
  inviterName: string;
  role: string;
};

type EmailOperations = {
  send(message: EmailMessage): Promise<{ id: string }>;
  sendInvitationEmail(message: InvitationEmail): Promise<{ id: string }>;
  sendVerificationEmail(message: AccountEmail): Promise<{ id: string }>;
  sendPasswordResetEmail(message: AccountEmail): Promise<{ id: string }>;
};

export type EmailService = EmailOperations &
  ({ enabled: true } | { enabled: false });

export type CreateEmailOptions = {
  /** Defaults to process.env. Useful for deterministic tests. */
  env?: Record<string, string | undefined>;
  /** Injected transport keeps tests free of external requests. */
  sender?: EmailSender;
};

function validSenderAddress(from: string): boolean {
  const address = "[^\\s<>@\\r\\n]+@[^\\s<>@\\r\\n]+\\.[^\\s<>@\\r\\n]+";
  return (
    new RegExp(`^${address}$`).test(from) ||
    new RegExp(`^[^<>\\r\\n]+ <${address}>$`).test(from)
  );
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function accountUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Account email URL must be an absolute HTTP(S) URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("Account email URL must use HTTPS outside localhost");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Account email URL must not contain credentials");
  }
  return parsed.toString();
}

type ActionEmail = {
  to: string;
  subject: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  action: string;
  url: string;
  /** Why the recipient got this email and what to do if it wasn't them. */
  footnote: string;
};

/** SeatTrue palette as hex: email clients don't support oklch or CSS variables. */
const palette = {
  paper: "#f8f4ec",
  card: "#fffdf9",
  ink: "#1b2230",
  ink2: "#454c59",
  muted: "#666d79",
  rule: "#e3dccd",
  leak: "#c93d00",
  leakInk: "#fffdf9",
} as const;

const fontStack =
  "'Bricolage Grotesque','Inter','Segoe UI',Helvetica,Arial,sans-serif";

function actionMessage(message: ActionEmail): EmailMessage {
  const url = accountUrl(message.url);
  const { subject, heading, greeting, paragraphs, action, footnote } = message;
  const p = palette;
  const text = [
    "SeatTrue",
    "",
    heading,
    "",
    greeting,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${action}: ${url}`,
    "",
    footnote,
    "",
    "SeatTrue · Microsoft 365 license reconciliation for MSPs",
  ].join("\n");
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:${p.ink2};font-size:15px;line-height:1.6">${htmlEscape(paragraph)}</p>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${htmlEscape(subject)}</title></head><body style="margin:0;padding:0;background:${p.paper};color:${p.ink};font-family:${fontStack}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.paper}"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px"><tr><td style="padding:0 0 20px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:30px;height:30px;border-radius:7px;background:${p.leak};color:${p.leakInk};font-size:17px;font-weight:800;text-align:center;vertical-align:middle">S</td><td style="padding-left:10px;color:${p.ink};font-size:19px;font-weight:800;letter-spacing:-0.02em">SeatTrue</td></tr></table></td></tr><tr><td style="padding:32px;border:1px solid ${p.rule};border-radius:14px;background:${p.card}"><h1 style="margin:0 0 20px;color:${p.ink};font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.02em">${htmlEscape(heading)}</h1><p style="margin:0 0 16px;color:${p.ink2};font-size:15px;line-height:1.6">${htmlEscape(greeting)}</p>${body}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:10px;background:${p.leak}"><a href="${htmlEscape(url)}" style="display:inline-block;padding:14px 22px;color:${p.leakInk};font-size:15px;font-weight:700;text-decoration:none">${htmlEscape(action)}</a></td></tr></table><p style="margin:0;color:${p.muted};font-size:13px;line-height:1.6">If the button doesn't work, paste this link into your browser:<br><a href="${htmlEscape(url)}" style="color:${p.leak};overflow-wrap:anywhere;word-break:break-all">${htmlEscape(url)}</a></p></td></tr><tr><td style="padding:20px 8px 0;color:${p.muted};font-size:12px;line-height:1.6">${htmlEscape(footnote)}<br>SeatTrue · Microsoft 365 license reconciliation for MSPs</td></tr></table></td></tr></table></body></html>`;
  return { to: message.to, subject, html, text };
}

function accountMessage(
  kind: "verification" | "password-reset",
  message: AccountEmail,
): EmailMessage {
  const name = message.name?.trim();
  const greeting = name ? `Hi ${name},` : "Hello,";
  if (kind === "verification") {
    return actionMessage({
      to: message.to,
      subject: "Verify your email for SeatTrue",
      heading: "Confirm your work email",
      greeting,
      paragraphs: [
        "Confirm this address to finish setting up your SeatTrue workspace.",
        "Then upload last month's Pax8 export to see unbilled seats, stale prices and ghost licences in dollars.",
      ],
      action: "Verify email",
      url: message.url,
      footnote:
        "You got this because someone signed up for SeatTrue with this address. If it wasn't you, ignore this email and no account will be activated.",
    });
  }
  return actionMessage({
    to: message.to,
    subject: "Reset your SeatTrue password",
    heading: "Reset your password",
    greeting,
    paragraphs: [
      "Someone asked to reset the password for your SeatTrue account. The link works once and expires in 1 hour.",
    ],
    action: "Choose a new password",
    url: message.url,
    footnote:
      "If you didn't ask for this, ignore this email. Your password stays the same.",
  });
}

function invitationMessage(message: InvitationEmail): EmailMessage {
  const role = message.role === "admin" ? "an admin" : "a technician";
  return actionMessage({
    to: message.to,
    subject: `Join ${message.organizationName} on SeatTrue`,
    heading: `Join ${message.organizationName} on SeatTrue`,
    greeting: "Hello,",
    paragraphs: [
      `${message.inviterName} invited you to the ${message.organizationName} workspace as ${role}.`,
      "SeatTrue checks the monthly Pax8 bill against what each client is invoiced, so billing exceptions get fixed before invoices go out.",
      "Sign in or create an account with this email address, then accept. The invitation expires in 48 hours.",
    ],
    action: "Accept invitation",
    url: message.url,
    footnote:
      "If you weren't expecting this invitation, ignore this email. Nothing happens unless you accept.",
  });
}

function createResendSender(apiKey: string): EmailSender {
  const resend = new Resend(apiKey);
  return (message, options) => resend.emails.send(message, options);
}

/**
 * Optional Resend integration. Missing configuration disables sending; a partial
 * configuration fails at startup so verification and recovery never fail silently.
 */
export function createEmailService(
  options: CreateEmailOptions = {},
): EmailService {
  const env = options.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if ((apiKey && !from) || (!apiKey && from)) {
    throw new Error("Set both RESEND_API_KEY and EMAIL_FROM, or neither");
  }

  if (!apiKey || !from) {
    const unavailable = async (): Promise<never> => {
      throw new Error(
        "Email delivery is disabled; configure RESEND_API_KEY and EMAIL_FROM",
      );
    };
    return {
      enabled: false,
      send: unavailable,
      sendVerificationEmail: unavailable,
      sendPasswordResetEmail: unavailable,
      sendInvitationEmail: unavailable,
    };
  }

  if (!validSenderAddress(from)) {
    throw new Error(
      "EMAIL_FROM must be an email address or Name <email@domain>",
    );
  }

  const sender = options.sender ?? createResendSender(apiKey);

  const send: EmailOperations["send"] = async (message) => {
    if (!message.to.trim() || !message.subject.trim()) {
      throw new Error("Email recipient and subject are required");
    }
    const { idempotencyKey, ...payload } = message;
    const options = idempotencyKey ? { idempotencyKey } : undefined;
    const result = await sender({ from, ...payload }, options);
    if (result.error) {
      // Provider details can contain addresses or token-bearing links.
      throw new Error("Email provider rejected message");
    }
    if (!result.data?.id) {
      throw new Error("Email provider returned no message ID");
    }
    return { id: result.data.id };
  };

  return {
    enabled: true,
    send,
    async sendVerificationEmail(message) {
      return send(accountMessage("verification", message));
    },
    async sendPasswordResetEmail(message) {
      return send(accountMessage("password-reset", message));
    },
    async sendInvitationEmail(message) {
      return send(invitationMessage(message));
    },
  };
}
