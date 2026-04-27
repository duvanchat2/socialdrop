'use client';
import { useEffect } from 'react';

export default function CompetitorsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[competitors error]', error);
  }, [error]);

  return (
    <div className="p-8 text-center">
      <p className="text-red-400 font-mono text-sm mb-4">{error.message}</p>
      <pre className="text-xs text-gray-500 text-left max-w-2xl mx-auto overflow-auto mb-4">{error.stack}</pre>
      <button onClick={reset} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Reintentar</button>
    </div>
  );
}
