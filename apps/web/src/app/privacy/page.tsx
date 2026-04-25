export const metadata = {
  title: 'Política de Privacidad – SocialDrop',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 text-gray-100">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
      <p className="text-gray-400 mb-8">Última actualización: abril 2026</p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">1. Datos que recopilamos</h2>
        <p className="text-gray-300">
          Recopilamos información de cuentas de redes sociales conectadas
          (Instagram, Facebook, YouTube, TikTok) para gestionar la publicación
          de contenido en tu nombre.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">2. Cómo usamos tus datos</h2>
        <p className="text-gray-300">
          Usamos tus datos únicamente para publicar contenido en las plataformas
          que autorices. No vendemos ni compartimos tu información con terceros.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">3. Eliminación de datos</h2>
        <p className="text-gray-300">
          Para solicitar la eliminación de tus datos, envía un correo a{' '}
          <a href="mailto:soporte@socialdrop.online" className="text-indigo-400 hover:underline">
            soporte@socialdrop.online
          </a>{' '}
          con el asunto &quot;Eliminación de datos&quot;, o usa nuestra{' '}
          <a href="/privacy/deletion" className="text-indigo-400 hover:underline">
            página de solicitud de eliminación
          </a>
          . Procesamos las solicitudes en 72 horas.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">4. Contacto</h2>
        <p className="text-gray-300">
          Email:{' '}
          <a href="mailto:soporte@socialdrop.online" className="text-indigo-400 hover:underline">
            soporte@socialdrop.online
          </a>
          <br />
          Sitio web:{' '}
          <a href="https://app.socialdrop.online" className="text-indigo-400 hover:underline">
            https://app.socialdrop.online
          </a>
        </p>
      </section>
    </div>
  );
}
