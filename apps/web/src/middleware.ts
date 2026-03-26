import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'change-this-secret';
const COOKIE_NAME = 'sd_sess';
const PUBLIC_PATHS = ['/login', '/auth'];

function expectedToken(): string {
  return createHmac('sha256', SESSION_SECRET).update('authenticated').digest('hex');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (cookie && cookie === expectedToken()) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
};
