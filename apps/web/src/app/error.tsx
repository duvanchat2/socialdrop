'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-card p-6 text-center space-y-4">
        <AlertTriangle size={32} className="text-warning mx-auto" />
        <div>
          <h2 className="font-display font-semibold text-lg text-ink">Algo salió mal</h2>
          <p className="text-sm text-ink-muted mt-1">{error.message || 'Error inesperado'}</p>
          {error.digest && <p className="text-xs text-ink-muted mt-1">ID: {error.digest}</p>}
        </div>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-accent hover:opacity-90 rounded-pill text-sm font-medium text-ink"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
