import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      role: "ADMIN" | "STAFF" | "STUDENT";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    error?: "SessionInvalidated";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "ADMIN" | "STAFF" | "STUDENT";
    sessionVersion?: number;
    sessionInvalidated?: boolean;
  }
}
