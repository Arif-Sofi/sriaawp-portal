import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { db } from "@/lib/db";
import { loadSessionContext } from "@/lib/rbac/session-context";

const isDevelopment = process.env.NODE_ENV === "development";

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
      sendVerificationRequest: async ({ url, identifier, provider, request }) => {
        if (isDevelopment || !process.env.AUTH_RESEND_KEY) {
          console.log(
            `\n[auth] magic link for ${identifier} (dev fallback):\n${url}\n`,
          );
          return;
        }
        const { Resend: ResendClient } = await import("resend");
        const client = new ResendClient(provider.apiKey);
        const { error } = await client.emails.send({
          from: provider.from ?? fromAddress,
          to: identifier,
          subject: "Pautan Log Masuk Portal SRIAAWP / SRIAAWP Portal Sign-in Link",
          text: [
            `Klik pautan ini untuk log masuk: ${url}`,
            "",
            `Click this link to sign in: ${url}`,
            "",
            "Pautan akan tamat dalam 24 jam. / Link expires in 24 hours.",
          ].join("\n"),
        });
        if (error) {
          throw new Error(`Resend send failed: ${error.message}`);
        }
        void request;
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
