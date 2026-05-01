import Link from 'next/link';

export const metadata = { title: 'Política de Privacidad — SocialDrop' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/landing" className="text-indigo-400 hover:underline text-sm mb-8 inline-block">← Volver</Link>
        <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: mayo 2025</p>

        <div className="space-y-8 text-gray-300 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Datos que recopilamos</h2>
            <p>SocialDrop recopila únicamente los datos necesarios para prestar el servicio: nombre, correo electrónico, credenciales de acceso a plataformas sociales (tokens OAuth) y el contenido (textos, imágenes y videos) que tú mismo subes para programar publicaciones.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Uso de los datos</h2>
            <p>Usamos tus datos exclusivamente para publicar contenido en las plataformas que has conectado, en la fecha y hora que tú indiques. No vendemos ni compartimos tus datos con terceros salvo cuando es necesario para completar la publicación (APIs de Meta, TikTok o Google).</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Almacenamiento de medios</h2>
            <p>Los archivos de imagen y video se almacenan temporalmente en nuestros servidores y se eliminan automáticamente 5 minutos después de ser publicados. Los borradores y publicaciones programadas se conservan hasta que los elimines manualmente.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Seguridad</h2>
            <p>Los tokens de acceso se almacenan cifrados. Utilizamos HTTPS en todas las comunicaciones. Puedes revocar el acceso desde la sección de Integraciones en cualquier momento.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Tus derechos</h2>
            <p>Tienes derecho a acceder, corregir o eliminar tus datos. Para solicitar la eliminación de tu cuenta escríbenos a <a href="mailto:soporte@socialdrop.app" className="text-indigo-400 hover:underline">soporte@socialdrop.app</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Contacto</h2>
            <p>Si tienes preguntas escríbenos a <a href="mailto:soporte@socialdrop.app" className="text-indigo-400 hover:underline">soporte@socialdrop.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
