'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [done,    setDone]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } finally {
      // Always show the same neutral confirmation — the API never reveals
      // whether the email exists, so the UI shouldn't either.
      setDone(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Olvidé mi contraseña</h1>
        </div>

        {done ? (
          <p className="text-sm text-gray-300 text-center">
            Si el correo existe, te enviamos instrucciones para restablecer tu contraseña.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo"
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
          </form>
        )}

        <p className="text-sm text-gray-400 text-center">
          <Link href="/login" className="hover:text-indigo-400">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
