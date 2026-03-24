'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Link2, Unlink, Loader2 } from 'lucide-react';

const PLATFORMS = [
  { id: 'FACEBOOK',  label: 'Facebook',   color: '#1877F2', bg: 'bg-blue-950'  },
  { id: 'INSTAGRAM', label: 'Instagram',  color: '#E1306C', bg: 'bg-pink-950'  },
  { id: 'TWITTER',   label: 'X / Twitter',color: '#1DA1F2', bg: 'bg-sky-950'   },
  { id: 'TIKTOK',    label: 'TikTok',     color: '#69C9D0', bg: 'bg-gray-900'  },
  { id: 'YOUTUBE',   label: 'YouTube',    color: '#FF0000', bg: 'bg-red-950'   },
];

interface Integration {
  id: string; platform: string; accountName?: string; createdAt: string;
}

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const [userId] = useState('demo-user');
  const searchParams = useSearchParams();

  // Show success toast when redirected back with ?connected=PLATFORM
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      const platform = PLATFORMS.find(p => p.id === connected.toUpperCase());
      toast.success(`✅ ${platform?.label ?? connected} conectado correctamente`);
      qc.invalidateQueries({ queryKey: ['integrations'] });
      // Clean query param without full reload
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, qc]);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => apiFetch<Integration[]>(`/api/integrations?userId=${userId}`),
    refetchInterval: 10_000,
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/integrations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integración desconectada');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const connectUrl = (platformId: string) =>
    `${API_URL}/api/integrations/connect?platform=${platformId}&userId=${userId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Integraciones</h1>
        {isLoading && <Loader2 className="animate-spin text-gray-400" size={20} />}
      </div>

      <p className="text-gray-400 text-sm">
        Conecta tus redes sociales para empezar a programar publicaciones.
        Haz clic en <strong>Conectar</strong> y autoriza la aplicación en cada plataforma.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map(({ id, label, color, bg }) => {
          const integration = integrations.find(i => i.platform === id);
          const isDisconnecting = disconnectMutation.isPending &&
            disconnectMutation.variables === integration?.id;

          return (
            <div key={id} className={`${bg} border border-gray-800 rounded-xl p-5 space-y-4`}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: color }}
                  >
                    {label[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{label}</p>
                    {integration ? (
                      <p className="text-xs text-green-400">{integration.accountName ?? 'Conectado'}</p>
                    ) : (
                      <p className="text-xs text-gray-500">No conectado</p>
                    )}
                  </div>
                </div>
                {integration
                  ? <CheckCircle className="text-green-400 shrink-0" size={22} />
                  : <XCircle className="text-gray-600 shrink-0" size={22} />}
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  integration
                    ? 'bg-green-900/60 text-green-300 border border-green-800'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${integration ? 'bg-green-400' : 'bg-gray-600'}`} />
                  {integration ? 'Conectado' : 'Desconectado'}
                </span>
                {integration?.createdAt && (
                  <span className="text-xs text-gray-500">
                    desde {new Date(integration.createdAt).toLocaleDateString('es-CO')}
                  </span>
                )}
              </div>

              {/* Action button */}
              {integration ? (
                <button
                  onClick={() => disconnectMutation.mutate(integration.id)}
                  disabled={isDisconnecting}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-900/40 hover:bg-red-900/70 border border-red-800/60 rounded-lg text-sm text-red-300 transition-colors disabled:opacity-50"
                >
                  {isDisconnecting
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Unlink size={14} />}
                  Desconectar
                </button>
              ) : (
                <a
                  href={connectUrl(id)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-700 hover:bg-indigo-600 border border-indigo-600 rounded-lg text-sm text-white font-medium transition-colors"
                >
                  <Link2 size={14} /> Conectar
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Debug: API URL indicator */}
      <p className="text-xs text-gray-600">
        API: <code className="text-gray-500">{API_URL}</code>
      </p>
    </div>
  );
}
