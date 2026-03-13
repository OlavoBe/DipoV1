import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === '/demo' ||
    pathname.startsWith('/api/auth');

  if (!isPublic) {
    // NextAuth v5 usa "authjs.session-token" (ou versão Secure em HTTPS)
    const hasSession =
      req.cookies.has('authjs.session-token') ||
      req.cookies.has('__Secure-authjs.session-token');

    if (!hasSession) {
      return NextResponse.redirect(new URL('/api/auth/signin', req.url));
    }
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
