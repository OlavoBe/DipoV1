import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tenantId: string | null;
      onboardingComplete: boolean;
    } & DefaultSession['user'];
  }
}
