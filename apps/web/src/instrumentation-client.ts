import * as Sentry from '@sentry/nextjs';

// Auto-detected by Next.js — runs once in the browser on page load.
// Sentry.init is a no-op if the DSN is unset.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
});
