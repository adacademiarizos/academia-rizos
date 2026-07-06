import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import {
  createAccountDeletionRequest,
  processAccountDeletion,
  purgeExpiredGuestAppointments,
} from "../src/server/services/gdpr-service.ts";
import { verifyAccountDeletionToken } from "../src/lib/gdpr.ts";

function createFakePrisma() {
  const state = {
    user: {
      id: "user_1",
      email: "cliente@example.com",
      name: "Cliente",
      password: null,
      deletedAt: null,
      image: "https://cdn.example.com/avatar.png",
    },
    deletionRequests: [],
    appointments: [],
    payments: [],
    paymentLinks: [],
    chatMessages: [],
    comments: [],
    bugReports: [],
  };

  const prisma = {
    state,
    user: {
      findUnique: async ({ where }) => {
        if (where.id && where.id !== state.user.id) return null;
        if (where.email && where.email !== state.user.email) return null;
        return { ...state.user };
      },
      update: async ({ where, data }) => {
        assert.equal(where.id, state.user.id);
        Object.assign(state.user, data);
        return { ...state.user };
      },
    },
    accountDeletionRequest: {
      create: async ({ data }) => {
        const request = {
          id: `req_${state.deletionRequests.length + 1}`,
          requestedAt: new Date("2026-07-05T10:00:00.000Z"),
          confirmedAt: null,
          completedAt: null,
          status: "PENDING",
          reason: data.reason ?? null,
          originalEmail: data.originalEmail ?? null,
          userId: data.userId,
          errorDetail: null,
        };
        state.deletionRequests.push(request);
        return { id: request.id, requestedAt: request.requestedAt };
      },
      findFirst: async ({ where }) =>
        state.deletionRequests.find((request) => {
          if (where.id && request.id !== where.id) return false;
          if (where.userId && request.userId !== where.userId) return false;
          if (where.originalEmail && request.originalEmail !== where.originalEmail)
            return false;
          if (where.status && request.status !== where.status) return false;
          return true;
        }) ?? null,
      update: async ({ where, data }) => {
        const request = state.deletionRequests.find((item) => item.id === where.id);
        assert.ok(request);
        Object.assign(request, data);
        return { ...request };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const request of state.deletionRequests) {
          if (where.id && request.id !== where.id) continue;
          if (where.userId && request.userId !== where.userId) continue;
          if (
            where.status?.not &&
            request.status === where.status.not
          ) {
            continue;
          }
          Object.assign(request, data);
          count += 1;
        }
        return { count };
      },
    },
    appointment: {
      findMany: async ({ where, take }) => {
        const items = state.appointments.filter((appointment) => {
          if (where.customerId !== undefined && appointment.customerId !== where.customerId) {
            return false;
          }
          if (where.customerId === null && appointment.customerId !== null) {
            return false;
          }
          if (
            where.customerEmail?.not === null &&
            appointment.customerEmail === null
          ) {
            return false;
          }
          if (where.anonymizedAt === null && appointment.anonymizedAt !== null) {
            return false;
          }
          if (where.startAt?.lt && !(appointment.startAt < where.startAt.lt)) {
            return false;
          }
          if (where.updatedAt?.lt && !(appointment.updatedAt < where.updatedAt.lt)) {
            return false;
          }
          return true;
        });
        return items.slice(0, take ?? items.length).map((item) => ({ ...item }));
      },
      update: async ({ where, data }) => {
        const appointment = state.appointments.find((item) => item.id === where.id);
        assert.ok(appointment);
        Object.assign(appointment, data);
        return { ...appointment };
      },
    },
    payment: {
      findMany: async ({ where }) =>
        state.payments
          .filter((payment) => payment.payerId === where.payerId)
          .map((payment) => ({ ...payment })),
      update: async ({ where, data }) => {
        const payment = state.payments.find((item) => item.id === where.id);
        assert.ok(payment);
        Object.assign(payment, data);
        return { ...payment };
      },
    },
    paymentLink: {
      findMany: async ({ where }) =>
        state.paymentLinks
          .filter(
            (link) =>
              link.customerEmail === where.customerEmail &&
              link.status !== where.status.not
          )
          .map((link) => ({ ...link })),
      update: async ({ where, data }) => {
        const paymentLink = state.paymentLinks.find((item) => item.id === where.id);
        assert.ok(paymentLink);
        Object.assign(paymentLink, data);
        return { ...paymentLink };
      },
    },
    chatMessage: {
      findMany: async ({ where }) =>
        state.chatMessages
          .filter(
            (message) =>
              message.userId === where.userId &&
              (where.imageUrl?.not !== null || message.imageUrl !== null)
          )
          .map((message) => ({ ...message })),
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const message of state.chatMessages) {
          if (message.userId !== where.userId) continue;
          Object.assign(message, data);
          count += 1;
        }
        return { count };
      },
    },
    comment: {
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const comment of state.comments) {
          if (comment.userId !== where.userId) continue;
          Object.assign(comment, data);
          count += 1;
        }
        return { count };
      },
    },
    bugReport: {
      findMany: async ({ where }) =>
        state.bugReports
          .filter((report) => report.userId === where.userId)
          .map((report) => ({ ...report })),
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const report of state.bugReports) {
          if (report.userId !== where.userId) continue;
          Object.assign(report, data);
          count += 1;
        }
        return { count };
      },
    },
    $transaction: async (handler) =>
      handler({
        accountDeletionRequest: prisma.accountDeletionRequest,
        appointment: prisma.appointment,
        payment: prisma.payment,
        paymentLink: prisma.paymentLink,
        chatMessage: prisma.chatMessage,
        comment: prisma.comment,
        bugReport: prisma.bugReport,
        user: prisma.user,
      }),
  };

  return prisma;
}

test("createAccountDeletionRequest generates email confirmation for oauth-only users", async () => {
  process.env.NEXTAUTH_SECRET = "test-secret";

  const prisma = createFakePrisma();
  const mailCalls = [];

  const result = await createAccountDeletionRequest({
    prisma: prisma,
    appUrl: "https://app.example.com",
    user: {
      id: "user_1",
      email: "cliente@example.com",
      name: "Cliente",
      password: null,
      deletedAt: null,
    },
    sendVerificationEmail: async (payload) => {
      mailCalls.push(payload);
    },
  });

  assert.equal(result.confirmationMethod, "email");
  assert.equal(mailCalls.length, 1);
  const token = new URL(mailCalls[0].confirmUrl).searchParams.get("deleteToken");
  assert.ok(token);
  const payload = verifyAccountDeletionToken(token);
  assert.equal(payload.userId, "user_1");
  assert.equal(payload.requestId, result.requestId);
});

test("processAccountDeletion anonymizes related records and keeps payments", async () => {
  process.env.R2_PUBLIC_URL = "https://pub.r2.dev";

  const prisma = createFakePrisma();
  prisma.state.user.password = await bcrypt.hash("secret123", 4);
  prisma.state.deletionRequests.push({
    id: "req_1",
    userId: "user_1",
    requestedAt: new Date("2026-07-05T10:00:00.000Z"),
    confirmedAt: null,
    completedAt: null,
    status: "PENDING",
    reason: null,
    originalEmail: "cliente@example.com",
    errorDetail: null,
  });
  prisma.state.appointments.push({
    id: "appt_1",
    customerId: "user_1",
    customerName: "Cliente",
    customerEmail: "cliente@example.com",
    customerPhone: "123456",
    anonymizedAt: null,
    startAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
  });
  prisma.state.payments.push({
    id: "pay_1",
    payerId: "user_1",
    payerEmail: "cliente@example.com",
    receiptToEmail: "cliente@example.com",
  });
  prisma.state.paymentLinks.push({
    id: "plink_1",
    customerEmail: "cliente@example.com",
    status: "PAID",
  });
  prisma.state.chatMessages.push({
    id: "chat_1",
    userId: "user_1",
    body: "hola",
    imageUrl: "https://pub.r2.dev/chat-images/user_1/file.png",
  });
  prisma.state.comments.push({
    id: "comment_1",
    userId: "user_1",
    body: "mi comentario",
  });
  prisma.state.bugReports.push({
    id: "bug_1",
    userId: "user_1",
    title: "bug",
    description: "detalle",
    imageUrls: ["https://pub.r2.dev/bug-reports/user_1/file.png"],
  });

  const deletedKeys = [];
  let confirmationSentTo = null;

  const result = await processAccountDeletion({
    prisma: prisma,
    userId: "user_1",
    requestId: "req_1",
    password: "secret123",
    deleteObject: async (key) => {
      deletedKeys.push(key);
    },
    sendConfirmationEmail: async ({ to }) => {
      confirmationSentTo = to;
    },
  });

  assert.equal(result.alreadyDeleted, false);
  assert.equal(confirmationSentTo, "cliente@example.com");
  assert.deepEqual(deletedKeys.sort(), [
    "bug-reports/user_1/file.png",
    "chat-images/user_1/file.png",
  ]);
  assert.match(prisma.state.user.email, /deleted-user-user_1@anon\.apoteosicas\.local/);
  assert.equal(prisma.state.user.password, null);
  assert.equal(prisma.state.payments[0].payerId, null);
  assert.equal(prisma.state.chatMessages[0].imageUrl, null);
  assert.equal(prisma.state.comments[0].body, "[comentario eliminado]");
  assert.equal(prisma.state.deletionRequests[0].status, "COMPLETED");
});

test("processAccountDeletion sends confirmation email only after full cleanup succeeds", async () => {
  process.env.R2_PUBLIC_URL = "https://pub.r2.dev";

  const prisma = createFakePrisma();
  prisma.state.user.password = await bcrypt.hash("secret123", 4);
  prisma.state.deletionRequests.push({
    id: "req_1",
    userId: "user_1",
    requestedAt: new Date("2026-07-05T10:00:00.000Z"),
    confirmedAt: null,
    completedAt: null,
    status: "PENDING",
    reason: null,
    originalEmail: "cliente@example.com",
    errorDetail: null,
  });
  prisma.state.chatMessages.push({
    id: "chat_1",
    userId: "user_1",
    body: "hola",
    imageUrl: "https://pub.r2.dev/chat-images/user_1/file.png",
  });

  let confirmationSent = false;

  const result = await processAccountDeletion({
    prisma: prisma,
    userId: "user_1",
    requestId: "req_1",
    password: "secret123",
    deleteObject: async () => {
      throw new Error("temporary cleanup failure");
    },
    sendConfirmationEmail: async () => {
      confirmationSent = true;
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  });

  assert.equal(result.cleanupFailures, 1);
  assert.equal(confirmationSent, false);
  assert.equal(
    prisma.state.deletionRequests[0].errorDetail,
    "R2 cleanup pending for 1 object(s)"
  );
});

test("processAccountDeletion is idempotent for already anonymized users", async () => {
  const prisma = createFakePrisma();
  prisma.state.user.deletedAt = new Date("2026-07-05T11:00:00.000Z");
  prisma.state.deletionRequests.push({
    id: "req_1",
    userId: "user_1",
    requestedAt: new Date("2026-07-05T10:00:00.000Z"),
    confirmedAt: null,
    completedAt: null,
    status: "PENDING",
    reason: null,
    originalEmail: "cliente@example.com",
    errorDetail: null,
  });

  const result = await processAccountDeletion({
    prisma: prisma,
    userId: "user_1",
    requestId: "req_1",
    password: "anything",
  });

  assert.equal(result.alreadyDeleted, true);
  assert.equal(prisma.state.deletionRequests[0].status, "COMPLETED");
});

test("purgeExpiredGuestAppointments only processes eligible guest rows once", async () => {
  const prisma = createFakePrisma();
  const now = new Date("2026-07-05T12:00:00.000Z");

  prisma.state.appointments.push(
    {
      id: "guest_old",
      customerId: null,
      customerName: "Invitada",
      customerEmail: "guest@example.com",
      customerPhone: "999",
      anonymizedAt: null,
      startAt: new Date("2024-01-01T10:00:00.000Z"),
      updatedAt: new Date("2024-01-05T10:00:00.000Z"),
    },
    {
      id: "guest_recent",
      customerId: null,
      customerName: "Reciente",
      customerEmail: "recent@example.com",
      customerPhone: "111",
      anonymizedAt: null,
      startAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    }
  );

  const firstRun = await purgeExpiredGuestAppointments({
    prisma: prisma,
    now,
    batchSize: 10,
  });
  const secondRun = await purgeExpiredGuestAppointments({
    prisma: prisma,
    now,
    batchSize: 10,
  });

  assert.equal(firstRun.processed, 1);
  assert.equal(secondRun.processed, 0);
  assert.equal(prisma.state.appointments[0].anonymizedAt?.toISOString(), now.toISOString());
  assert.equal(prisma.state.appointments[1].customerEmail, "recent@example.com");
});
