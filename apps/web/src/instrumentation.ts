import * as Sentry from '@sentry/nextjs';

// Auto-detected by Next.js — runs once when the server/edge runtime boots.
// Sentry.init is a no-op if SENTRY_DSN is unset, so this is safe with no
// tracker configured. GlitchTip is DSN/API-compatible with this SDK.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
