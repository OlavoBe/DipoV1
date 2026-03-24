import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Resend from 'next-auth/providers/resend';
import { prisma } from '@/lib/db';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? 'noreply@example.com',
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;

      // sessionToken é incluído pelo PrismaAdapter no objeto session
      const currentToken = (session as any).sessionToken as string | undefined;

      const [dbUser, activeSessions] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: { tenantId: true, onboardingComplete: true, isAdmin: true },
        }),
        prisma.session.findMany({
          where: { userId: user.id, expires: { gt: new Date() } },
          orderBy: { criadoEm: 'desc' },
          select: { id: true, sessionToken: true },
        }),
      ]);

      session.user.tenantId = dbUser?.tenantId ?? null;
      session.user.onboardingComplete = dbUser?.onboardingComplete ?? false;
      session.user.isAdmin = dbUser?.isAdmin ?? false;

      if (activeSessions.length > 1) {
        const newestToken = activeSessions[0].sessionToken;
        const olderIds = activeSessions.slice(1).map((s) => s.id);

        // Expira todas as sessões antigas no banco
        await prisma.session.updateMany({
          where: { id: { in: olderIds } },
          data: { expires: new Date(0) },
        });

        // Se o request atual está usando uma sessão antiga, invalida imediatamente
        if (currentToken && currentToken !== newestToken) {
          return null as any;
        }
      }

      return session;
    },
  },
});
