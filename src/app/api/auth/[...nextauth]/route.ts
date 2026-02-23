import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const handler = NextAuth({
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

        // Secure password comparison using bcryptjs
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
      // Si entra por Google, upsert user en DB
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
    async jwt({ token }) {
      if (!token.email) return token;

      const dbUser = await db.user.findUnique({
        where: { email: token.email.toLowerCase() },
        select: { id: true, role: true },
      });

      if (dbUser) {
        token.userId = dbUser.id;
        token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error
        session.user.id = token.userId;
        // @ts-expect-error
        session.user.role = token.role;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
