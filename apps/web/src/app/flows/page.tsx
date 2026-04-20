'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { GitBranch, Plus, ToggleLeft, ToggleRight, Trash2, Zap } from 'lucide-react';

interface Flow {
  id: string;
  name: string;
  platform: string;
  trigger: string;
  keyword?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { executions: number };
}

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  FACEBOOK: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TIKTOK: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  YOUTUBE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TRIGGER_LABELS: Record<string, string> = {
  COMMENT_KEYWORD: 'Keyword en comentario',
  DM_RECEIVED: 'DM recibido',
  STORY_REPLY: 'Respuesta a historia',
  SEQUENCE: 'Secuencia',
};

export default function FlowsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPlatform, setNewPlatform] = useState('INSTAGRAM');
  const [newTrigger, setNewTrigger] = useState('COMMENT_KEYWORD');
  const [newKeyword, setNewKeyword] = useState('');

  const { data: flows = [], isLoading } = useQuery<Flow[]>({
    queryKey: ['flows'],
    queryFn: () => apiFetch('/api/flows'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch('/api/flows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flows'] }); setCreating(false); setNewName(''); setNewKeyword(''); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/flows/${id}/toggle`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/flows/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="text-indigo-500" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Flujos de Automatización</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Responde automáticamente a comentarios y mensajes</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nuevo flujo
        </button>
      </div>

      {creating && (
        <div className="mb-6 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <h2 className="font-semibold mb-4 text-gray-900 dark:text-white">Nuevo flujo</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nombre del flujo"
              className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
            <select
              value={newPlatform}
              onChange={e => setNewPlatform(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            >
              {['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={newTrigger}
              onChange={e => setNewTrigger(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            >
              {Object.entries(TRIGGER_LABELS).filter(([k]) => k !== 'SEQUENCE').map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {newTrigger === 'COMMENT_KEYWORD' && (
              <input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder="Keyword (ej: INFO)"
                className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate({ name: newName, platform: newPlatform, trigger: newTrigger, keyword: newKeyword || undefined })}
              disabled={!newName || createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {createMutation.isPending ? 'Creando...' : 'Crear'}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Cargando flujos...</div>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-gray-400 dark:text-gray-600 gap-3">
          <Zap size={40} />
          <p className="text-sm">No hay flujos. Crea uno para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flows.map(flow => (
            <div
              key={flow.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${flow.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div className="min-w-0">
                  <Link
                    href={`/flows/${flow.id}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block"
                  >
                    {flow.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[flow.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                      {flow.platform}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {TRIGGER_LABELS[flow.trigger] ?? flow.trigger}
                      {flow.keyword && ` · "${flow.keyword}"`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {flow._count !== undefined && (
                  <span className="text-xs text-gray-400 mr-2">{flow._count.executions} ejecuciones</span>
                )}
                <button
                  onClick={() => toggleMutation.mutate(flow.id)}
                  className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title={flow.isActive ? 'Desactivar' : 'Activar'}
                >
                  {flow.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                </button>
                <Link
                  href={`/flows/${flow.id}`}
                  className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Editar"
                >
                  <GitBranch size={16} />
                </Link>
                <button
                  onClick={() => deleteMutation.mutate(flow.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
