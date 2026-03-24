'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ background: '#030712', color: '#f9fafb', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Algo salió mal</h2>
          <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>Ocurrió un error inesperado.</p>
          <button
            onClick={() => reset()}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
