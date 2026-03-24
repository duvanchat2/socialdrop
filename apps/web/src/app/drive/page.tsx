'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL } from '@/lib/api';
import { useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DriveStatus {
  id: string; folderId: string; folderName?: string;
  syncEnabled: boolean; lastSyncAt?: string; pollingInterval: number;
}

export default function DrivePage() {
  const qc = useQueryClient();
  const [folderId, setFolderId] = useState('');
  const [userId] = useState('demo-user');

  const statusQuery = useQuery({
    queryKey: ['drive-status'],
    queryFn: () => apiFetch<DriveStatus[]>(`/api/drive/status?userId=${userId}`),
  });

  const configureMutation = useMutation({
    mutationFn: (data: { folderId: string }) =>
      apiFetch(`/api/drive/configure?userId=${userId}`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('Carpeta configurada correctamente');
      qc.invalidateQueries({ queryKey: ['drive-status'] });
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const syncMutation = useMutation({
    mutationFn: (configId: string) =>
      apiFetch(`/api/drive/sync/${configId}`, { method: 'POST' }),
    onSuccess: () => toast.success('Sync iniciado'),
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const connected = (statusQuery.data?.length ?? 0) > 0;

  const CSV_EXAMPLE = `caption,scheduled_date,platforms,media_files
"¡Nuevo producto disponible! 🎉",2026-04-01T10:00:00Z,"instagram,facebook","photo1.jpg,photo2.jpg"
"Video de demostración",2026-04-02T15:00:00Z,"tiktok,youtube","demo.mp4"`;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Google Drive</h1>

      {/* Connection status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {connected
            ? <CheckCircle className="text-green-400" size={24} />
            : <XCircle className="text-red-400" size={24} />}
          <div>
            <p className="font-medium">{connected ? 'Google Drive conectado' : 'No conectado'}</p>
            <p className="text-xs text-gray-400">
              {connected
                ? statusQuery.data?.[0]?.folderName ?? statusQuery.data?.[0]?.folderId
                : 'Conecta tu Google Drive para importar posts'}
            </p>
          </div>
        </div>
        <a
          href={`${API_URL}/api/drive/auth?userId=${userId}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium"
        >
          {connected ? 'Reconectar' : 'Conectar Drive'}
        </a>
      </div>

      {/* Configure folder */}
      {connected && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Carpeta a monitorear</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ID de la carpeta de Google Drive"
              value={folderId}
              onChange={e => setFolderId(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => configureMutation.mutate({ folderId })}
              disabled={!folderId || configureMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              Guardar
            </button>
          </div>
          <p className="text-xs text-gray-500">
            El ID está en la URL de la carpeta: drive.google.com/drive/folders/<strong>ESTE_ES_EL_ID</strong>
          </p>
        </div>
      )}

      {/* Sync status */}
      {statusQuery.data?.map(config => (
        <div key={config.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Estado del Sync</h2>
            <button
              onClick={() => syncMutation.mutate(config.id)}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
            >
              {syncMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Sincronizar ahora
            </button>
          </div>
          <div className="text-sm text-gray-400 space-y-1">
            <p>Carpeta: <span className="text-gray-200">{config.folderName ?? config.folderId}</span></p>
            <p>Intervalo: <span className="text-gray-200">{config.pollingInterval}s</span></p>
            {config.lastSyncAt && (
              <p>Último sync: <span className="text-gray-200">
                {format(new Date(config.lastSyncAt), 'dd MMM yyyy HH:mm', { locale: es })}
              </span></p>
            )}
          </div>
        </div>
      ))}

      {/* CSV format */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Formato del CSV</h2>
        <p className="text-sm text-gray-400">Sube un archivo CSV en tu carpeta de Drive con este formato:</p>
        <pre className="bg-gray-950 rounded-lg p-3 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">{CSV_EXAMPLE}</pre>
        <p className="text-xs text-gray-500">
          Plataformas válidas: instagram, facebook, twitter, tiktok, youtube (separadas por coma)
        </p>
      </div>
    </div>
  );
}
