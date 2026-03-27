'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { PostStatus } from './StatusBadge';

const PLATFORMS = [
  { id: 'FACEBOOK',  label: 'Facebook',    color: '#1877F2' },
  { id: 'INSTAGRAM', label: 'Instagram',   color: '#E1306C' },
  { id: 'TWITTER',   label: 'X / Twitter', color: '#1DA1F2' },
  { id: 'TIKTOK',    label: 'TikTok',      color: '#000000' },
  { id: 'YOUTUBE',   label: 'YouTube',     color: '#FF0000' },
];

const USER_ID = 'demo-user';

export interface EditablePost {
  id: string;
  content: string;
  status: PostStatus;
  scheduledAt: string;
  integrations: { integration: { platform: string } }[];
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  post: EditablePost | null;
  onClose: () => void;
}

export function EditPostModal({ post, onClose }: Props) {
  const qc = useQueryClient();
  const [content,     setContent]     = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [platforms,   setPlatforms]   = useState<string[]>([]);

  useEffect(() => {
    if (post) {
      setContent(post.content);
      setScheduledAt(toLocalInput(post.scheduledAt));
      setPlatforms(post.integrations.map(pi => pi.integration.platform));
    }
  }, [post]);

  const updateMutation = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts/${post!.id}?userId=${USER_ID}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('Post actualizado correctamente');
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      qc.invalidateQueries({ queryKey: ['posts-failed'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  if (!post) return null;

  const canEdit = post.status === 'SCHEDULED' || post.status === 'ERROR' || post.status === 'PENDING';

  function handleSave() {
    if (!content.trim())    { toast.error('El caption no puede estar vacío'); return; }
    if (!platforms.length)  { toast.error('Selecciona al menos una plataforma'); return; }
    if (!scheduledAt)       { toast.error('Selecciona una fecha y hora'); return; }
    updateMutation.mutate({
      content,
      scheduledAt: new Date(scheduledAt).toISOString(),
      platforms,
    });
  }

  function togglePlatform(id: string) {
    setPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const statusColors: Record<string, string> = {
    PUBLISHED:  'bg-green-900 text-green-300',
    ERROR:      'bg-red-900 text-red-300',
    SCHEDULED:  'bg-blue-900 text-blue-300',
    PUBLISHING: 'bg-purple-900 text-purple-300',
    PENDING:    'bg-yellow-900 text-yellow-300',
    DRAFT:      'bg-gray-700 text-gray-300',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-lg">Editar Post</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[post.status] ?? 'bg-gray-700 text-gray-300'}`}>
            {post.status}
          </span>
          {!canEdit && (
            <span className="text-xs text-gray-500">
              {post.status === 'PUBLISHED' ? 'Los posts publicados no se pueden editar' : 'No editable en este estado'}
            </span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Caption</label>
          <textarea
            rows={4}
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={!canEdit}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Fecha y hora</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            disabled={!canEdit}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Plataformas</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                type="button"
                disabled={!canEdit}
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                  platforms.includes(p.id)
                    ? 'border-indigo-500 bg-indigo-950 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
