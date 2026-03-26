import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'change-this-secret';
const APP_PASSWORD   = process.env.APP_PASSWORD   ?? 'changeme';
const COOKIE_NAME    = 'sd_sess';
const SEVEN_DAYS     = 60 * 60 * 24 * 7;

function sessionToken(): string {
  return createHmac('sha256', SESSION_SECRET).update('authenticated').digest('hex');
}

export async function POST(request: NextRequest) {
  const { password } = await request.json().catch(() => ({ password: '' }));

  if (!password || password !== APP_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   SEVEN_DAYS,
    path:     '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
