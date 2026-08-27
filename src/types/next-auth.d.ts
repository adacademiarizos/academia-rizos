import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & { id: string; role: "ADMIN" | "STAFF" | "STUDENT" };
    error?: "SessionInvalidated";
    invalidated?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "ADMIN" | "STAFF" | "STUDENT";
    sessionVersion?: number;
    sessionInvalidated?: boolean;
    deletedAt?: string | null;
    invalidated?: boolean;
  }
}
