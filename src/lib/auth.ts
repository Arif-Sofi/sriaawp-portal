import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { sendMagicLink } from "@/lib/auth/send-magic-link";
import { db } from "@/lib/db";
import { loadSessionContext } from "@/lib/rbac/session-context";

const fromAddress = process.env.AUTH_EMAIL_FROM ?? "SRIAAWP <no-reply@sriaawp.edu.my>";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "dev-noop",
      from: fromAddress,
      sendVerificationRequest: async ({ url, identifier, provider }) => {
        await sendMagicLink({
          url,
          identifier,
          apiKey: typeof provider.apiKey === "string" ? provider.apiKey : "dev-noop",
          from: typeof provider.from === "string" ? provider.from : fromAddress,
        });
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login/error",
  },
  callbacks: {
    async session({ session, user }) {
      const ctx = await loadSessionContext(user.id);
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          roles: ctx.roles,
          permissions: ctx.permissions,
          deptIds: ctx.deptIds,
          status: ctx.status,
        },
      };
    },
  },
});
