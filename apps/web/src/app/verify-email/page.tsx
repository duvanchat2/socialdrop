'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    apiFetch('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl text-center">
        <h1 className="text-2xl font-bold text-white">Verificación de correo</h1>

        {status === 'pending' && <p className="text-sm text-gray-400">Verificando...</p>}
        {status === 'ok' && <p className="text-sm text-gray-300">Tu correo fue verificado correctamente.</p>}
        {status === 'error' && (
          <p className="text-sm text-red-400">El enlace es inválido o expiró.</p>
        )}

        <p className="text-sm text-gray-400">
          <Link href="/login" className="hover:text-indigo-400">Ir a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
