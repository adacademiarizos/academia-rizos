import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isSessionVersionStale } from "@/lib/password-reset";

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: '/signin',
  },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";

        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordMatch = user.password
          ? await bcrypt.compare(password, user.password)
          : false;

        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        await db.user.upsert({
          where: { email: user.email.toLowerCase() },
          create: {
            email: user.email.toLowerCase(),
            name: user.name,
            image: user.image,
            role: "STUDENT",
          },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (!token.email) return token;

      const dbUser = await db.user.findUnique({
        where: { email: token.email.toLowerCase() },
        select: { id: true, role: true, sessionVersion: true },
      });

      if (!dbUser) {
        return { sessionInvalidated: true };
      }

      if (!user && isSessionVersionStale(token.sessionVersion, dbUser.sessionVersion)) {
        return { sessionInvalidated: true };
      }

      token.userId = dbUser.id;
      token.role = dbUser.role;
      token.sessionVersion = dbUser.sessionVersion;

      return token;
    },
    async session({ session, token }) {
      if (token.sessionInvalidated || !session.user) {
        return {
          ...session,
          error: "SessionInvalidated",
          user: undefined,
        };
      }

      if (session.user) {
        const sessionUser = session.user as typeof session.user & {
          id: string;
          role: "ADMIN" | "STAFF" | "STUDENT";
        };

        sessionUser.id = token.userId ?? "";
        sessionUser.role = token.role ?? "STUDENT";
      }
      return session;
    },
  },
};
