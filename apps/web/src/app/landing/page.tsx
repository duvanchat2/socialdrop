import Link from 'next/link';
import { Calendar, Zap, BarChart2, Shield, CheckCircle } from 'lucide-react';

export const metadata = { title: 'SocialDrop — Programa tu contenido social' };

const FEATURES = [
  { icon: Calendar, title: 'Programación visual', desc: 'Arrastra tus publicaciones en un calendario y olvídate.' },
  { icon: Zap,      title: 'Publicación automática', desc: 'Publica en Instagram, TikTok, YouTube, Facebook y más sin intervención manual.' },
  { icon: BarChart2, title: 'Analytics integrado', desc: 'Visualiza el rendimiento de tus publicaciones desde un solo panel.' },
  { icon: Shield,   title: 'Compresión automática', desc: 'Los videos se comprimen automáticamente antes de subirse para ahorrarte espacio y tiempo.' },
];

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X / Twitter'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">SocialDrop</span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">scheduler</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">Privacidad</Link>
            <Link href="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">Términos</Link>
            <Link href="/support" className="text-sm text-gray-400 hover:text-white transition-colors">Soporte</Link>
            <Link
              href="/login"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          Programa, publica y analiza
        </div>
        <h1 className="text-5xl font-extrabold leading-tight mb-4">
          Tu contenido social,<br />
          <span className="text-indigo-400">en piloto automático</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          SocialDrop comprime, programa y publica tus videos e imágenes en todas tus redes sociales
          desde un solo lugar. Sin complicaciones.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-lg transition-colors"
          >
            Empezar gratis
          </Link>
          <Link
            href="/support"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold text-lg transition-colors text-gray-200"
          >
            Ver soporte
          </Link>
        </div>
      </section>

      {/* Platforms */}
      <section className="border-y border-gray-800 py-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-6">
          <p className="text-sm text-gray-500">Compatible con:</p>
          {PLATFORMS.map(p => (
            <span key={p} className="text-sm font-medium text-gray-300 bg-gray-800 px-3 py-1 rounded-full">{p}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center mb-12">Todo lo que necesitas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex gap-4">
              <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-950 flex items-center justify-center">
                <Icon size={20} className="text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-white mb-1">{title}</p>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20 text-center">
        <div className="bg-gradient-to-br from-indigo-950 to-gray-900 border border-indigo-800/40 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-3">¿Listo para empezar?</h2>
          <p className="text-gray-400 mb-8">Conecta tus redes sociales y programa tu primer post en minutos.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-lg transition-colors"
          >
            <CheckCircle size={20} />
            Empezar ahora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500">
          <p>© 2025 SocialDrop. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacidad</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Términos</Link>
            <Link href="/support" className="hover:text-gray-300 transition-colors">Soporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
