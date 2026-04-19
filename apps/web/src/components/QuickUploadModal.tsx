'use client';
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { uploadFile, UploadedFile } from '@/lib/uploadMedia';
import { toast } from 'sonner';
import { X, Upload, Loader2 } from 'lucide-react';

interface Props {
  date: Date | null;
  initialFiles?: File[];
  onClose: () => void;
}

/**
 * Lightweight modal used by the calendar to create a DRAFT post at a specific
 * date. Scheduled at `date @ 09:00 local`. Uses the shared `uploadFile`
 * helper and the existing /api/posts endpoint.
 */
export function QuickUploadModal({ date, initialFiles = [], onClose }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(0);

  const createPost = useMutation({
    mutationFn: (data: object) =>
      apiFetch(`/api/posts?userId=demo-user`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success('Borrador creado en el calendario');
      qc.invalidateQueries({ queryKey: ['posts-all'] });
      onClose();
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const handleFiles = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploading((c) => c + arr.length);
    try {
      const results = await Promise.allSettled(arr.map(uploadFile));
      const ok: UploadedFile[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') ok.push(r.value);
      }
      setFiles((prev) => [...prev, ...ok]);
    } finally {
      setUploading((c) => c - arr.length);
    }
  }, []);

  // Auto-upload when opened via drag (initialFiles)
  useInitialUpload(initialFiles, handleFiles);

  if (!date) return null;

  const handleSave = () => {
    const scheduledAt = new Date(date);
    scheduledAt.setHours(9, 0, 0, 0);
    createPost.mutate({
      content: caption || '(Borrador sin contenido)',
      scheduledAt: scheduledAt.toISOString(),
      platforms: [],
      status: 'DRAFT',
      mediaUrls: files.map((f) => f.url),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">Nuevo borrador</h3>
            <p className="text-xs text-gray-500">
              {date.toLocaleDateString('es-CO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <textarea
          rows={3}
          placeholder="Caption (opcional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
        />

        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-800 rounded-lg p-4 text-center cursor-pointer hover:border-gray-600 bg-gray-950"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {uploading > 0 ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 className="animate-spin" size={16} />
              Subiendo {uploading}…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Upload size={20} />
              <p className="text-sm">Drop files here or click to upload</p>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {files.map((f, i) => (
              <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 relative">
                {f.preview ? (
                  <img src={f.preview} alt={f.fileName} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-xs text-gray-400 p-1 truncate">{f.fileName}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={createPost.isPending || uploading > 0}
            className="px-3 py-1.5 text-sm rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-medium"
          >
            {createPost.isPending ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Runs handleFiles(initialFiles) only once on mount
function useInitialUpload(initial: File[], handleFiles: (f: File[]) => void) {
  const ran = useRef(false);
  if (!ran.current && initial.length > 0) {
    ran.current = true;
    // defer to next tick so state setters in the parent are consistent
    setTimeout(() => handleFiles(initial), 0);
  }
}
