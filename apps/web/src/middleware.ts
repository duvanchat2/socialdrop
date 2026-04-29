import { NextRequest, NextResponse } from 'next/server';

/** Paths that are publicly accessible (no auth required) */
const PUBLIC_PATHS = ['/login', '/privacy', '/terms'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) {
    // If already authenticated and visiting /login, redirect home
    if (pathname.startsWith('/login')) {
      const token = request.cookies.get('auth-token')?.value;
      if (token) return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Require auth-token cookie for all other pages
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude Next.js internals, static assets, and upload files from middleware
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
};
