import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hasCompletedDeletionForEmail } from "@/server/services/gdpr-service";

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

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            password: true,
            deletedAt: true,
          },
        });
        if (!user) return null;
        if (user.deletedAt || (await hasCompletedDeletionForEmail(email))) return null;

        const passwordMatch = user.password
          ? await bcrypt.compare(password, user.password)
          : false;

        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const normalizedEmail = user.email.toLowerCase();
        if (await hasCompletedDeletionForEmail(normalizedEmail)) {
          return false;
        }

        const existingUser = await db.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, deletedAt: true },
        });

        if (existingUser?.deletedAt) {
          return false;
        }

        await db.user.upsert({
          where: { email: normalizedEmail },
          create: {
            email: normalizedEmail,
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
    async jwt({ token }) {
      const dbUser =
        typeof token.userId === "string"
          ? await db.user.findUnique({
              where: { id: token.userId },
              select: { id: true, email: true, role: true, deletedAt: true },
            })
          : token.email
          ? await db.user.findUnique({
              where: { email: token.email.toLowerCase() },
              select: { id: true, email: true, role: true, deletedAt: true },
            })
          : null;
      const deletedAtIso =
        dbUser?.deletedAt instanceof Date ? dbUser.deletedAt.toISOString() : null;

      if (!dbUser || dbUser.deletedAt) {
        token.invalidated = true;
        token.userId = undefined;
        token.role = undefined;
        token.email = undefined;
        token.deletedAt = deletedAtIso;
        return token;
      }

      token.invalidated = false;
      token.userId = dbUser.id;
      token.role = dbUser.role;
      token.email = dbUser.email;
      token.deletedAt = deletedAtIso;

      return token;
    },
    async session({ session, token }) {
      if (!session.user || token.invalidated || !token.userId || !token.role) {
        session.invalidated = true;
        session.user = {
          ...session.user,
          id: "",
          email: undefined,
          role: "STUDENT",
        };
        return session;
      }

      session.invalidated = false;
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
};
