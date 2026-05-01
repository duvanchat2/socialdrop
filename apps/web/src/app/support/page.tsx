import Link from 'next/link';
import { Mail, MessageSquare, BookOpen } from 'lucide-react';

export const metadata = { title: 'Soporte — SocialDrop' };

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/landing" className="text-indigo-400 hover:underline text-sm mb-8 inline-block">← Volver</Link>
        <h1 className="text-3xl font-bold mb-2">Soporte</h1>
        <p className="text-gray-400 mb-10">¿Tienes problemas o preguntas? Estamos aquí para ayudarte.</p>

        <div className="space-y-4">
          <a
            href="mailto:soporte@socialdrop.app"
            className="flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-indigo-600 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-950 flex items-center justify-center shrink-0 group-hover:bg-indigo-900 transition-colors">
              <Mail size={20} className="text-indigo-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Correo electrónico</p>
              <p className="text-sm text-gray-400">soporte@socialdrop.app — respuesta en menos de 24h</p>
            </div>
          </a>

          <div className="flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
              <BookOpen size={20} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Documentación</p>
              <p className="text-sm text-gray-400">Próximamente — guías y tutoriales detallados.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
              <MessageSquare size={20} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Chat en vivo</p>
              <p className="text-sm text-gray-400">Próximamente — soporte en tiempo real.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 p-5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-400">
          <p className="font-semibold text-white mb-1">Problemas comunes</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Si una publicación falla, verifica que el token de la integración no haya expirado en <Link href="/integrations" className="text-indigo-400 hover:underline">Integraciones</Link>.</li>
            <li>Para Instagram, asegúrate de que la cuenta sea profesional (Business o Creator).</li>
            <li>Los videos deben estar en formato MP4 — SocialDrop los convierte automáticamente.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
