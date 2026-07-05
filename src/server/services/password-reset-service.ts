import bcrypt from "bcryptjs";
import { env } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  createPasswordResetToken,
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  getPasswordResetWindowStart,
  hashPasswordResetToken,
  INVALID_RESET_PASSWORD_MESSAGE,
  normalizeEmail,
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from "@/lib/password-reset";
import { db } from "@/lib/db";

type PasswordResetUser = {
  id: string;
  email: string;
  password: string | null;
  sessionVersion: number;
};

type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type PasswordResetDb = {
  user: {
    findUnique(args: {
      where: { email: string };
      select: {
        id: true;
        email: true;
        password: true;
        sessionVersion: true;
      };
    }): Promise<PasswordResetUser | null>;
  };
  passwordResetRequest: {
    count(args: {
      where: {
        createdAt: { gte: Date };
        email?: string;
        requestIp?: string;
      };
    }): Promise<number>;
    create(args: {
      data: {
        email: string;
        requestIp: string | null;
      };
    }): Promise<unknown>;
  };
  passwordResetToken: {
    create(args: {
      data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        requestIp: string | null;
      };
    }): Promise<unknown>;
    findUnique(args: {
      where: { tokenHash: string };
      select: {
        id: true;
        userId: true;
        tokenHash: true;
        expiresAt: true;
        usedAt: true;
      };
    }): Promise<PasswordResetTokenRecord | null>;
  };
  $transaction<T>(callback: (tx: PasswordResetTransaction) => Promise<T>): Promise<T>;
};

type PasswordResetTransaction = {
  passwordResetToken: {
    updateMany(args: {
      where: {
        id?: string;
        userId?: string;
        usedAt?: null;
        expiresAt?: { gt: Date };
        NOT?: { id: string };
      };
      data: {
        usedAt: Date;
      };
    }): Promise<{ count: number }>;
  };
  user: {
    update(args: {
      where: { id: string };
      data: {
        password: string;
        sessionVersion: { increment: number };
      };
    }): Promise<unknown>;
  };
};

type PasswordResetMailer = typeof sendPasswordResetEmail;

export class InvalidPasswordResetTokenError extends Error {
  constructor() {
    super(INVALID_RESET_PASSWORD_MESSAGE);
    this.name = "InvalidPasswordResetTokenError";
  }
}

export function createPasswordResetService(deps?: {
  db?: PasswordResetDb;
  sendPasswordResetEmail?: PasswordResetMailer;
  now?: () => Date;
  hashPassword?: (password: string) => Promise<string>;
  appUrl?: string;
}) {
  const database = deps?.db ?? (db as unknown as PasswordResetDb);
  const mailer = deps?.sendPasswordResetEmail ?? sendPasswordResetEmail;
  const now = deps?.now ?? (() => new Date());
  const hashPassword = deps?.hashPassword ?? ((password: string) => bcrypt.hash(password, 10));
  const appUrl = deps?.appUrl ?? env.NEXT_PUBLIC_APP_URL;

  return {
    async requestPasswordReset(params: { email: string; requestIp: string | null }) {
      const email = normalizeEmail(params.email);
      const currentTime = now();
      const windowStart = getPasswordResetWindowStart(currentTime);

      const [emailAttempts, ipAttempts, user] = await Promise.all([
        database.passwordResetRequest.count({
          where: {
            email,
            createdAt: { gte: windowStart },
          },
        }),
        params.requestIp
          ? database.passwordResetRequest.count({
              where: {
                requestIp: params.requestIp,
                createdAt: { gte: windowStart },
              },
            })
          : Promise.resolve(0),
        database.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            sessionVersion: true,
          },
        }),
      ]);

      const throttled =
        emailAttempts >= PASSWORD_RESET_EMAIL_LIMIT || ipAttempts >= PASSWORD_RESET_IP_LIMIT;

      if (throttled) {
        return {
          throttled: true,
          emailSent: false,
          message: GENERIC_FORGOT_PASSWORD_MESSAGE,
        };
      }

      await database.passwordResetRequest.create({
        data: {
          email,
          requestIp: params.requestIp,
        },
      });

      if (!user?.password) {
        return {
          throttled: false,
          emailSent: false,
          message: GENERIC_FORGOT_PASSWORD_MESSAGE,
        };
      }

      const { token, tokenHash, expiresAt } = createPasswordResetToken(currentTime);

      await database.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestIp: params.requestIp,
        },
      });

      const resetUrl = new URL("/reset-password", appUrl);
      resetUrl.searchParams.set("token", token);

      await mailer({
        to: user.email,
        resetUrl: resetUrl.toString(),
      });

      return {
        throttled: false,
        emailSent: true,
        message: GENERIC_FORGOT_PASSWORD_MESSAGE,
      };
    },

    async resetPassword(params: { token: string; password: string }) {
      const currentTime = now();
      const tokenHash = hashPasswordResetToken(params.token);

      const tokenRecord = await database.passwordResetToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          tokenHash: true,
          expiresAt: true,
          usedAt: true,
        },
      });

      if (
        !tokenRecord ||
        tokenRecord.usedAt !== null ||
        tokenRecord.expiresAt.getTime() <= currentTime.getTime()
      ) {
        throw new InvalidPasswordResetTokenError();
      }

      const hashedPassword = await hashPassword(params.password);

      await database.$transaction(async (tx) => {
        const claimedToken = await tx.passwordResetToken.updateMany({
          where: {
            id: tokenRecord.id,
            usedAt: null,
            expiresAt: { gt: currentTime },
          },
          data: {
            usedAt: currentTime,
          },
        });

        if (claimedToken.count === 0) {
          throw new InvalidPasswordResetTokenError();
        }

        await tx.user.update({
          where: { id: tokenRecord.userId },
          data: {
            password: hashedPassword,
            sessionVersion: { increment: 1 },
          },
        });

        await tx.passwordResetToken.updateMany({
          where: {
            userId: tokenRecord.userId,
            usedAt: null,
            NOT: { id: tokenRecord.id },
          },
          data: {
            usedAt: currentTime,
          },
        });
      });

      return {
        success: true,
        message: PASSWORD_RESET_SUCCESS_MESSAGE,
      };
    },
  };
}

export const passwordResetService = createPasswordResetService();
