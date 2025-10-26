import { Role } from "@prisma/client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import nodemailer from "nodemailer";
import { redirect } from "next/navigation";

import { env } from "./env";
import { prisma } from "./prisma";

function html(params: { url: string; host: string }) {
  const { url, host } = params;
  return `<!doctype html>
<html>
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <title>Sign in to ${host}</title>
  </head>
  <body>
    <p>Hello,</p>
    <p>Click the link below to sign in to <strong>${host}</strong>.</p>
    <p><a href="${url}">Sign in</a></p>
    <p>If you did not request this email you can safely ignore it.</p>
  </body>
</html>`;
}

function text(params: { url: string; host: string }) {
  const { url, host } = params;
  return `Sign in to ${host}\n${url}\n\nIf you did not request this email you can safely ignore it.`;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/sign-in"
  },
  providers: [
    EmailProvider({
      from: env.EMAIL_FROM,
      maxAge: 10 * 60,
      async sendVerificationRequest({ identifier, url }) {
        const transport = nodemailer.createTransport({
          host: env.EMAIL_SERVER_HOST,
          port: env.EMAIL_SERVER_PORT,
          secure: env.EMAIL_SERVER_SECURE,
          auth: env.EMAIL_SERVER_USER
            ? {
                user: env.EMAIL_SERVER_USER,
                pass: env.EMAIL_SERVER_PASSWORD as string
              }
            : undefined,
          tls: env.EMAIL_SERVER_SECURE
            ? undefined
            : {
                rejectUnauthorized: false
              }
        });

        const { host } = new URL(url);

        await transport.sendMail({
          to: identifier,
          from: env.EMAIL_FROM,
          subject: `Your sign-in link for ${host}`,
          text: text({ url, host }),
          html: html({ url, host })
        });

        if (env.NODE_ENV !== "production") {
          console.info(`🔐 Magic link sent to ${identifier}: ${url}`);
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: Role }).role ?? Role.CANDIDATE;
      } else if (token.sub && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true }
        });

        if (dbUser) {
          token.role = dbUser.role;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }

      if (session.user && token?.role) {
        session.user.role = token.role as Role;
      }

      return session;
    }
  }
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getServerAuthSession();

  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
}

type RequireRoleOptions = {
  redirectTo?: string;
  unauthorizedRedirect?: string;
};

export async function requireRole(required: Role | Role[], options: RequireRoleOptions = {}) {
  const session = await getServerAuthSession();
  const roles = Array.isArray(required) ? required : [required];
  const redirectTo = options.redirectTo ?? "/";
  const unauthorizedRedirect = options.unauthorizedRedirect ?? "/unauthorized";

  if (!session) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(redirectTo)}`);
  }

  const role = session.user?.role ?? Role.CANDIDATE;

  if (!roles.includes(role)) {
    redirect(unauthorizedRedirect);
  }

  return session;
}
