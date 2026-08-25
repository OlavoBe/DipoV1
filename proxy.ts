import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/login',
  '/planos',
  '/demo',
  '/api/demo',
  '/api/auth',
  '/api/webhooks',
  '/upgrade',
  '/test-login',
  '/api/test-login',
  // Inerte sem PDF_HEALTH_TOKEN e protegida por token quando ativa — o smoke
  // test pos-deploy precisa alcanca-la sem sessao.
  '/api/health',
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
