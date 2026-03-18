import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/demo',
  '/api/demo',
  '/api/auth',
  '/api/webhooks',
  '/upgrade',
  '/test-login',
  '/api/test-login',
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  if (!isPublic) {
    const hasSession =
      req.cookies.has('authjs.session-token') ||
      req.cookies.has('__Secure-authjs.session-token');

    if (!hasSession) {
      return NextResponse.redirect(new URL('/api/auth/signin', req.url));
    }
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)).*)'],
};
