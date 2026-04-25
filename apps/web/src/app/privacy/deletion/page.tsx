'use client';
import { useState } from 'react';
import { API_URL } from '@/lib/api';

export default function DeletionRequestPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/users/deletion-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text);
      }
      setStatus('done');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 text-gray-100">
      <h1 className="text-3xl font-bold mb-2">Solicitud de Eliminación de Datos</h1>
      <p className="text-gray-400 mb-8">Última actualización: abril 2026</p>

      <section className="mb-8">
        <p className="text-gray-300 mb-4">
          Conforme al artículo 17 del RGPD y legislación aplicable, tienes derecho a
          solicitar la eliminación de todos los datos personales que SocialDrop almacena
          sobre ti. Una vez procesada la solicitud, eliminaremos permanentemente:
        </p>
        <ul className="list-disc list-inside text-gray-300 space-y-1 mb-4">
          <li>Tokens de acceso a redes sociales conectadas</li>
          <li>Publicaciones programadas y borradores</li>
          <li>Archivos multimedia subidos</li>
          <li>Configuración de marca y estrategia</li>
        </ul>
        <p className="text-gray-400 text-sm">
          Las solicitudes se procesan en un plazo máximo de <strong className="text-gray-200">72 horas</strong>.
          Recibirás confirmación por correo electrónico.
        </p>
      </section>

      {status === 'done' ? (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
          <p className="text-green-400 text-lg font-semibold mb-1">✓ Solicitud recibida</p>
          <p className="text-gray-300 text-sm">
            Procesaremos la eliminación de los datos asociados a{' '}
            <strong>{email}</strong> en las próximas 72 horas.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {status === 'error' && (
            <p className="text-sm text-red-400">{errorMsg || 'Error al enviar la solicitud. Intenta nuevamente.'}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !email}
            className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {status === 'loading' ? 'Enviando…' : 'Solicitar eliminación de mis datos'}
          </button>

          <p className="text-xs text-gray-500">
            También puedes escribirnos a{' '}
            <a href="mailto:soporte@socialdrop.online" className="text-indigo-400 hover:underline">
              soporte@socialdrop.online
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
