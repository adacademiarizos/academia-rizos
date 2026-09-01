import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import {
  GDPR_BUG_DESCRIPTION_PLACEHOLDER,
  GDPR_BUG_TITLE_PLACEHOLDER,
  GDPR_CHAT_PLACEHOLDER,
  GDPR_COMMENT_PLACEHOLDER,
  GDPR_USER_DELETED_NAME,
  buildDeletedEmail,
  buildGuestRetentionCutoff,
  createAccountDeletionToken,
  extractStorageKeyFromUrl,
  verifyAccountDeletionToken,
} from "@/lib/gdpr";

type Logger = Pick<Console, "warn" | "error" | "info">;

type DbClient = PrismaClient;

type DeletionRequestUser = {
  id: string;
  email: string;
  name: string | null;
  password: string | null;
  deletedAt: Date | null;
};

type VerificationMailer = (params: {
  to: string;
  name?: string | null;
  confirmUrl: string;
  expiresAt: Date;
}) => Promise<void>;

type ConfirmationMailer = (params: {
  to: string;
  name?: string | null;
}) => Promise<void>;

type CreateDeletionRequestInput = {
  user: DeletionRequestUser;
  reason?: string;
  appUrl: string;
  prisma?: DbClient;
  now?: Date;
  sendVerificationEmail?: VerificationMailer;
};

type ProcessAccountDeletionInput = {
  userId: string;
  requestId?: string;
  password?: string;
  token?: string;
  reason?: string;
  prisma?: DbClient;
  now?: Date;
  deleteObject?: (key: string) => Promise<void>;
  sendConfirmationEmail?: ConfirmationMailer;
  logger?: Logger;
};

type PurgeExpiredGuestsInput = {
  prisma?: DbClient;
  now?: Date;
  batchSize?: number;
};

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function cleanReason(reason?: string) {
  const value = reason?.trim();
  return value ? value : null;
}

function defaultLogger(): Logger {
  return console;
}

export async function hasCompletedDeletionForEmail(
  email: string,
  prisma: DbClient = db
) {
  const normalizedEmail = normalizeEmail(email);
  const match = await prisma.accountDeletionRequest.findFirst({
    where: {
      originalEmail: normalizedEmail,
      status: "COMPLETED",
    },
    select: { id: true },
  });

  return Boolean(match);
}

export async function createAccountDeletionRequest({
  user,
  reason,
  appUrl,
  prisma = db,
  now = new Date(),
  sendVerificationEmail,
}: CreateDeletionRequestInput) {
  const normalizedEmail = normalizeEmail(user.email);
  const deletionReason = cleanReason(reason);

  const request = await prisma.accountDeletionRequest.create({
    data: {
      userId: user.id,
      originalEmail: normalizedEmail,
      reason: deletionReason,
    },
    select: {
      id: true,
      requestedAt: true,
    },
  });

  if (user.password) {
    return {
      requestId: request.id,
      confirmationMethod: "password" as const,
    };
  }

  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const token = createAccountDeletionToken({
    userId: user.id,
    requestId: request.id,
    exp: expiresAt.getTime(),
  });

  if (sendVerificationEmail) {
    const confirmUrl = new URL("/account", appUrl);
    confirmUrl.searchParams.set("deleteToken", token);

    await sendVerificationEmail({
      to: normalizedEmail,
      name: user.name,
      confirmUrl: confirmUrl.toString(),
      expiresAt,
    });
  }

  return {
    requestId: request.id,
    confirmationMethod: "email" as const,
    expiresAt,
  };
}

export async function processAccountDeletion({
  userId,
  requestId,
  password,
  token,
  reason,
  prisma = db,
  now = new Date(),
  deleteObject,
  sendConfirmationEmail,
  logger = defaultLogger(),
}: ProcessAccountDeletionInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      deletedAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  let resolvedRequestId = requestId;
  if (token) {
    const payload = verifyAccountDeletionToken(token);
    if (payload.userId !== userId) {
      throw new Error("Deletion token does not belong to this user");
    }
    resolvedRequestId = payload.requestId;
  }

  if (!resolvedRequestId) {
    throw new Error("Deletion request not found");
  }

  const request = await prisma.accountDeletionRequest.findFirst({
    where: {
      id: resolvedRequestId,
      userId,
    },
    select: {
      id: true,
      status: true,
      originalEmail: true,
      confirmedAt: true,
      completedAt: true,
      reason: true,
    },
  });

  if (!request) {
    throw new Error("Deletion request not found");
  }

  if (user.deletedAt || request.status === "COMPLETED") {
    await prisma.accountDeletionRequest.updateMany({
      where: {
        id: resolvedRequestId,
        userId,
        status: { not: "COMPLETED" },
      },
      data: {
        status: "COMPLETED",
        confirmedAt: request.confirmedAt ?? now,
        completedAt: request.completedAt ?? user.deletedAt ?? now,
        errorDetail: null,
      },
    });

    return {
      requestId: resolvedRequestId,
      alreadyDeleted: true,
      cleanupFailures: 0,
    };
  }

  if (password) {
    if (!user.password) {
      throw new Error("This account requires email confirmation instead of password");
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new Error("Invalid confirmation password");
    }
  } else if (!token) {
    throw new Error("Account deletion confirmation is required");
  }

  const originalEmail = request.originalEmail ?? normalizeEmail(user.email);
  const deletionReason = cleanReason(reason) ?? request.reason ?? null;

  const [
    appointments,
    payments,
    paymentLinks,
    chatMessages,
    bugReports,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { customerId: userId },
      select: { id: true },
    }),
    prisma.payment.findMany({
      where: { payerId: userId },
      select: {
        id: true,
        payerEmail: true,
        receiptToEmail: true,
      },
    }),
    prisma.paymentLink.findMany({
      where: {
        customerEmail: originalEmail,
        status: { not: "REQUIRES_PAYMENT" },
      },
      select: { id: true },
    }),
    prisma.chatMessage.findMany({
      where: {
        userId,
        imageUrl: { not: null },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    }),
    prisma.bugReport.findMany({
      where: { userId },
      select: {
        id: true,
        imageUrls: true,
      },
    }),
  ]);

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.accountDeletionRequest.update({
        where: { id: resolvedRequestId },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          reason: deletionReason,
          errorDetail: null,
        },
      });

      await Promise.all(
        appointments.map((appointment: (typeof appointments)[number]) =>
          tx.appointment.update({
            where: { id: appointment.id },
            data: {
              customerName: GDPR_USER_DELETED_NAME,
              customerEmail: buildDeletedEmail("appointment", appointment.id),
              customerPhone: null,
              anonymizedAt: now,
            },
          })
        )
      );

      await Promise.all(
        payments.map((payment: (typeof payments)[number]) =>
          tx.payment.update({
            where: { id: payment.id },
            data: {
              payerId: null,
              payerEmail: payment.payerEmail
                ? buildDeletedEmail("payment", payment.id)
                : null,
              receiptToEmail: payment.receiptToEmail
                ? buildDeletedEmail("payment-receipt", payment.id)
                : null,
            },
          })
        )
      );

      await Promise.all(
        paymentLinks.map((paymentLink: (typeof paymentLinks)[number]) =>
          tx.paymentLink.update({
            where: { id: paymentLink.id },
            data: {
              customerEmail: buildDeletedEmail("payment-link", paymentLink.id),
            },
          })
        )
      );

      await tx.chatMessage.updateMany({
        where: { userId },
        data: {
          body: GDPR_CHAT_PLACEHOLDER,
          imageUrl: null,
        },
      });

      await tx.comment.updateMany({
        where: { userId },
        data: {
          body: GDPR_COMMENT_PLACEHOLDER,
        },
      });

      await tx.bugReport.updateMany({
        where: { userId },
        data: {
          title: GDPR_BUG_TITLE_PLACEHOLDER,
          description: GDPR_BUG_DESCRIPTION_PLACEHOLDER,
          imageUrls: [],
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          name: GDPR_USER_DELETED_NAME,
          email: buildDeletedEmail("user", userId),
          image: null,
          password: null,
          deletedAt: now,
        },
      });

      await tx.accountDeletionRequest.update({
        where: { id: resolvedRequestId },
        data: {
          status: "COMPLETED",
          confirmedAt: now,
          completedAt: now,
          reason: deletionReason,
          errorDetail: null,
        },
      });
    });
  } catch (error) {
    await prisma.accountDeletionRequest.updateMany({
      where: { id: resolvedRequestId, userId },
      data: {
        status: "FAILED",
        errorDetail: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      },
    });
    throw error;
  }

  const storageKeys = [
    ...chatMessages
      .map((message: (typeof chatMessages)[number]) =>
        extractStorageKeyFromUrl(message.imageUrl)
      )
      .filter((key): key is string => Boolean(key)),
    ...bugReports.flatMap((report: (typeof bugReports)[number]) =>
      report.imageUrls
        .map((url: string) => extractStorageKeyFromUrl(url))
        .filter((key): key is string => Boolean(key))
    ),
  ];

  const cleanupFailures: string[] = [];
  if (deleteObject) {
    for (const storageKey of storageKeys) {
      try {
        await deleteObject(storageKey);
      } catch (error) {
        cleanupFailures.push(storageKey);
        logger.error("[gdpr] failed to delete R2 object", {
          storageKey,
          error,
        });
      }
    }
  }

  if (cleanupFailures.length > 0) {
    await prisma.accountDeletionRequest.updateMany({
      where: { id: resolvedRequestId, userId },
      data: {
        errorDetail: `R2 cleanup pending for ${cleanupFailures.length} object(s)`,
      },
    });
  }

  if (sendConfirmationEmail && cleanupFailures.length === 0) {
    try {
      await sendConfirmationEmail({
        to: originalEmail,
        name: user.name,
      });
    } catch (error) {
      logger.warn("[gdpr] account deletion confirmation email failed", error);
    }
  }

  return {
    requestId: resolvedRequestId,
    alreadyDeleted: false,
    cleanupFailures: cleanupFailures.length,
  };
}

export async function purgeExpiredGuestAppointments({
  prisma = db,
  now = new Date(),
  batchSize = 100,
}: PurgeExpiredGuestsInput) {
  const cutoff = buildGuestRetentionCutoff(now);
  let processed = 0;

  while (true) {
    const batch = await prisma.appointment.findMany({
      where: {
        customerId: null,
        customerEmail: { not: null },
        anonymizedAt: null,
        startAt: { lt: cutoff },
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: "asc" },
      take: batchSize,
      select: { id: true },
    });

    if (batch.length === 0) break;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await Promise.all(
        batch.map((appointment: (typeof batch)[number]) =>
          tx.appointment.update({
            where: { id: appointment.id },
            data: {
              customerName: GDPR_USER_DELETED_NAME,
              customerEmail: buildDeletedEmail("guest-appointment", appointment.id),
              customerPhone: null,
              anonymizedAt: now,
            },
          })
        )
      );
    });

    processed += batch.length;

    if (batch.length < batchSize) {
      break;
    }
  }

  return { processed, cutoff };
}
