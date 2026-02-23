import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "STAFF" | "STUDENT";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
