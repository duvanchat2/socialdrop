'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ background: '#030712', color: '#f9fafb', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '800px', width: '100%' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f87171' }}>Error Global</h2>
          <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>{error?.message || 'Sin mensaje'}</p>
          {error?.digest && <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.5rem' }}>digest: {error.digest}</p>}
          <pre style={{ textAlign: 'left', background: '#111827', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.7rem', color: '#9ca3af', overflowX: 'auto', marginBottom: '1.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {error?.stack || 'Sin stack trace'}
          </pre>
          <button
            onClick={() => reset()}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
