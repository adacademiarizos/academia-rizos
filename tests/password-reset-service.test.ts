import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/app";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "secret";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "google-client";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "google-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "stripe-secret";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "stripe-webhook";
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "stripe-publishable";
process.env.EMAIL_FROM = process.env.EMAIL_FROM ?? "hello@example.com";

const passwordResetLib = await import("../src/lib/password-reset");
const passwordResetServiceModule = await import("../src/server/services/password-reset-service");

const {
  createPasswordResetService,
  InvalidPasswordResetTokenError,
} = passwordResetServiceModule;
const {
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
  hashPasswordResetToken,
  isSessionVersionStale,
} = passwordResetLib;

type FakeUser = {
  id: string;
  email: string;
  password: string | null;
  sessionVersion: number;
};

type FakeResetRequest = {
  email: string;
  requestIp: string | null;
  createdAt: Date;
};

type FakeResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  requestIp: string | null;
};

function createFakeDb(params: {
  now: Date;
  users?: FakeUser[];
  requests?: FakeResetRequest[];
  tokens?: FakeResetToken[];
}) {
  const users = new Map((params.users ?? []).map((user) => [user.email, { ...user }]));
  const requests = [...(params.requests ?? [])];
  const tokens = [...(params.tokens ?? [])];

  const db = {
    user: {
      async findUnique(args: { where: { email: string } }) {
        return users.get(args.where.email) ?? null;
      },
    },
    passwordResetRequest: {
      async count(args: { where: { createdAt: { gte: Date }; email?: string; requestIp?: string } }) {
        return requests.filter((request) => {
          if (request.createdAt < args.where.createdAt.gte) {
            return false;
          }

          if (args.where.email && request.email !== args.where.email) {
            return false;
          }

          if (args.where.requestIp && request.requestIp !== args.where.requestIp) {
            return false;
          }

          return true;
        }).length;
      },
      async create(args: { data: { email: string; requestIp: string | null } }) {
        const request = {
          ...args.data,
          createdAt: params.now,
        };
        requests.push(request);
        return request;
      },
    },
    passwordResetToken: {
      async create(args: {
        data: {
          userId: string;
          tokenHash: string;
          expiresAt: Date;
          requestIp: string | null;
        };
      }) {
        const token = {
          id: `token-${tokens.length + 1}`,
          userId: args.data.userId,
          tokenHash: args.data.tokenHash,
          expiresAt: args.data.expiresAt,
          usedAt: null,
          requestIp: args.data.requestIp,
        };
        tokens.push(token);
        return token;
      },
      async findUnique(args: { where: { tokenHash: string } }) {
        return tokens.find((token) => token.tokenHash === args.where.tokenHash) ?? null;
      },
      async updateMany(args: {
        where: {
          id?: string;
          userId?: string;
          usedAt?: null;
          expiresAt?: { gt: Date };
          NOT?: { id: string };
        };
        data: { usedAt: Date };
      }) {
        let count = 0;

        for (const token of tokens) {
          if (args.where.id && token.id !== args.where.id) continue;
          if (args.where.userId && token.userId !== args.where.userId) continue;
          if (args.where.usedAt === null && token.usedAt !== null) continue;
          if (args.where.expiresAt && !(token.expiresAt > args.where.expiresAt.gt)) continue;
          if (args.where.NOT?.id && token.id === args.where.NOT.id) continue;

          token.usedAt = args.data.usedAt;
          count += 1;
        }

        return { count };
      },
    },
    async $transaction<T>(callback: (tx: unknown) => Promise<T>) {
      return callback({
        passwordResetToken: db.passwordResetToken,
        user: {
          async update(args: {
            where: { id: string };
            data: { password: string; sessionVersion: { increment: number } };
          }) {
            const user = [...users.values()].find((current) => current.id === args.where.id);
            if (!user) {
              throw new Error("User not found");
            }

            user.password = args.data.password;
            user.sessionVersion += args.data.sessionVersion.increment;

            return user;
          },
        },
      });
    },
  };

  return { db, users, requests, tokens };
}

test("requestPasswordReset returns generic success for unknown emails", async () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const sentEmails: Array<{ to: string; resetUrl: string }> = [];
  const fakeDb = createFakeDb({ now });

  const service = createPasswordResetService({
    db: fakeDb.db as never,
    sendPasswordResetEmail: async (params) => {
      sentEmails.push(params);
    },
    now: () => now,
    appUrl: "https://example.com",
  });

  const result = await service.requestPasswordReset({
    email: "missing@example.com",
    requestIp: "127.0.0.1",
  });

  assert.equal(result.message, GENERIC_FORGOT_PASSWORD_MESSAGE);
  assert.equal(result.emailSent, false);
  assert.equal(sentEmails.length, 0);
  assert.equal(fakeDb.requests.length, 1);
  assert.equal(fakeDb.tokens.length, 0);
});

test("requestPasswordReset does not send reset links for Google-only accounts", async () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const sentEmails: Array<{ to: string; resetUrl: string }> = [];
  const fakeDb = createFakeDb({
    now,
    users: [
      {
        id: "user-1",
        email: "google@example.com",
        password: null,
        sessionVersion: 0,
      },
    ],
  });

  const service = createPasswordResetService({
    db: fakeDb.db as never,
    sendPasswordResetEmail: async (params) => {
      sentEmails.push(params);
    },
    now: () => now,
    appUrl: "https://example.com",
  });

  const result = await service.requestPasswordReset({
    email: "google@example.com",
    requestIp: "127.0.0.1",
  });

  assert.equal(result.message, GENERIC_FORGOT_PASSWORD_MESSAGE);
  assert.equal(result.emailSent, false);
  assert.equal(sentEmails.length, 0);
  assert.equal(fakeDb.requests.length, 1);
  assert.equal(fakeDb.tokens.length, 0);
});

test("requestPasswordReset throttles by email and IP", async () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const fakeDb = createFakeDb({
    now,
    users: [
      {
        id: "user-1",
        email: "user@example.com",
        password: "hashed-password",
        sessionVersion: 0,
      },
    ],
    requests: [
      ...Array.from({ length: PASSWORD_RESET_EMAIL_LIMIT }, () => ({
        email: "user@example.com",
        requestIp: "127.0.0.1",
        createdAt: now,
      })),
      ...Array.from({ length: PASSWORD_RESET_IP_LIMIT }, () => ({
        email: "other@example.com",
        requestIp: "10.0.0.5",
        createdAt: now,
      })),
    ],
  });

  const service = createPasswordResetService({
    db: fakeDb.db as never,
    sendPasswordResetEmail: async () => {
      throw new Error("should not send");
    },
    now: () => now,
    appUrl: "https://example.com",
  });

  const emailLimited = await service.requestPasswordReset({
    email: "user@example.com",
    requestIp: "127.0.0.1",
  });

  const ipLimited = await service.requestPasswordReset({
    email: "user@example.com",
    requestIp: "10.0.0.5",
  });

  assert.equal(emailLimited.throttled, true);
  assert.equal(ipLimited.throttled, true);
  assert.equal(fakeDb.requests.length, PASSWORD_RESET_EMAIL_LIMIT + PASSWORD_RESET_IP_LIMIT);
  assert.equal(fakeDb.tokens.length, 0);
});

test("resetPassword rejects expired tokens", async () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const fakeDb = createFakeDb({
    now,
    tokens: [
      {
        id: "token-1",
        userId: "user-1",
        tokenHash: hashPasswordResetToken("expired-token"),
        expiresAt: new Date("2026-07-05T10:00:00.000Z"),
        usedAt: null,
        requestIp: "127.0.0.1",
      },
    ],
  });

  const service = createPasswordResetService({
    db: fakeDb.db as never,
    sendPasswordResetEmail: async () => undefined,
    now: () => now,
    hashPassword: async (password) => `hashed:${password}`,
    appUrl: "https://example.com",
  });

  await assert.rejects(
    service.resetPassword({ token: "expired-token", password: "new-password" }),
    InvalidPasswordResetTokenError
  );
});

test("resetPassword rejects already-used tokens", async () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const fakeDb = createFakeDb({
    now,
    tokens: [
      {
        id: "token-1",
        userId: "user-1",
        tokenHash: hashPasswordResetToken("used-token"),
        expiresAt: new Date("2026-07-05T13:00:00.000Z"),
        usedAt: new Date("2026-07-05T11:30:00.000Z"),
        requestIp: "127.0.0.1",
      },
    ],
  });

  const service = createPasswordResetService({
    db: fakeDb.db as never,
    sendPasswordResetEmail: async () => undefined,
    now: () => now,
    hashPassword: async (password) => `hashed:${password}`,
    appUrl: "https://example.com",
  });

  await assert.rejects(
    service.resetPassword({ token: "used-token", password: "new-password" }),
    InvalidPasswordResetTokenError
  );
});

test("resetPassword updates the password, invalidates sibling tokens and bumps sessionVersion", async () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const fakeDb = createFakeDb({
    now,
    users: [
      {
        id: "user-1",
        email: "user@example.com",
        password: "old-hash",
        sessionVersion: 0,
      },
    ],
    tokens: [
      {
        id: "token-1",
        userId: "user-1",
        tokenHash: hashPasswordResetToken("valid-token"),
        expiresAt: new Date("2026-07-05T13:00:00.000Z"),
        usedAt: null,
        requestIp: "127.0.0.1",
      },
      {
        id: "token-2",
        userId: "user-1",
        tokenHash: hashPasswordResetToken("sibling-token"),
        expiresAt: new Date("2026-07-05T13:00:00.000Z"),
        usedAt: null,
        requestIp: "127.0.0.1",
      },
    ],
  });

  const service = createPasswordResetService({
    db: fakeDb.db as never,
    sendPasswordResetEmail: async () => undefined,
    now: () => now,
    hashPassword: async (password) => `hashed:${password}`,
    appUrl: "https://example.com",
  });

  const result = await service.resetPassword({
    token: "valid-token",
    password: "new-password",
  });

  const updatedUser = fakeDb.users.get("user@example.com");
  const usedToken = fakeDb.tokens.find((token) => token.id === "token-1");
  const siblingToken = fakeDb.tokens.find((token) => token.id === "token-2");

  assert.equal(result.success, true);
  assert.equal(updatedUser?.password, "hashed:new-password");
  assert.equal(updatedUser?.sessionVersion, 1);
  assert.equal(usedToken?.usedAt?.toISOString(), now.toISOString());
  assert.equal(siblingToken?.usedAt?.toISOString(), now.toISOString());
  assert.equal(isSessionVersionStale(0, updatedUser?.sessionVersion ?? 0), true);
});
