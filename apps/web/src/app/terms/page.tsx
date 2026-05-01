import Link from 'next/link';

export const metadata = { title: 'Términos de Uso — SocialDrop' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/landing" className="text-indigo-400 hover:underline text-sm mb-8 inline-block">← Volver</Link>
        <h1 className="text-3xl font-bold mb-2">Términos de Uso</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: mayo 2025</p>

        <div className="space-y-8 text-gray-300 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Aceptación</h2>
            <p>Al usar SocialDrop aceptas estos términos. Si no estás de acuerdo, no utilices el servicio.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Uso permitido</h2>
            <p>SocialDrop está diseñado para programar y publicar contenido propio en plataformas sociales conectadas. Queda prohibido su uso para publicar contenido que infrinja derechos de terceros, spam, discurso de odio o cualquier contenido ilegal.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Cuentas y acceso</h2>
            <p>Eres responsable de mantener la confidencialidad de tus credenciales. SocialDrop no es responsable de accesos no autorizados derivados de tu negligencia.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Disponibilidad del servicio</h2>
            <p>Nos esforzamos por mantener el servicio disponible 24/7, pero no garantizamos uptime ininterrumpido. Las publicaciones fallidas por causas ajenas a SocialDrop (APIs de terceros, tokens expirados) son responsabilidad del usuario.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Propiedad intelectual</h2>
            <p>Todo el contenido que subes es de tu propiedad. Al usar SocialDrop nos otorgas únicamente los permisos necesarios para procesarlo y publicarlo en tu nombre.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Terminación</h2>
            <p>Podemos suspender o cancelar tu acceso si violas estos términos. Puedes cancelar tu cuenta en cualquier momento desde Configuración o escribiendo a <a href="mailto:soporte@socialdrop.app" className="text-indigo-400 hover:underline">soporte@socialdrop.app</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Contacto</h2>
            <p>Para preguntas legales escríbenos a <a href="mailto:soporte@socialdrop.app" className="text-indigo-400 hover:underline">soporte@socialdrop.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
