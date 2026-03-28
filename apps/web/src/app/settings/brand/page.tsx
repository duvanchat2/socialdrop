'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Loader2, Plus, X, Save } from 'lucide-react';
import { toast } from 'sonner';

const USER_ID = 'demo-user';
const TONES = [
  { value: 'CASUAL', label: 'Casual' },
  { value: 'FORMAL', label: 'Formal' },
  { value: 'FUNNY', label: 'Divertido' },
  { value: 'INSPIRATIONAL', label: 'Inspiracional' },
] as const;

const PLATFORMS_TIME = ['instagram', 'tiktok', 'facebook', 'youtube', 'twitter'] as const;

interface BrandProfile {
  brandName: string;
  niche: string;
  tone: 'CASUAL' | 'FORMAL' | 'FUNNY' | 'INSPIRATIONAL';
  alwaysUseWords: string[];
  neverUseWords: string[];
  fixedHashtags: string[];
  optimalTimes: Record<string, string[]>;
}

function TagInput({
  label, values, onChange, placeholder,
}: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim().replace(/^#/, '');
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 bg-gray-700 text-gray-200 px-2 py-0.5 rounded-full text-xs">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder ?? 'Enter y agrega…'}
        />
        <button
          type="button"
          onClick={add}
          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function BrandProfilePage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<BrandProfile>({
    queryKey: ['brand-profile'],
    queryFn: () => apiFetch(`/api/brand?userId=${USER_ID}`),
  });

  const [form, setForm] = useState<BrandProfile>({
    brandName: '', niche: '', tone: 'CASUAL',
    alwaysUseWords: [], neverUseWords: [], fixedHashtags: [],
    optimalTimes: {
      instagram: ['09:00', '12:00', '18:00'],
      tiktok: ['07:00', '15:00', '21:00'],
      facebook: ['10:00', '14:00'],
      youtube: ['15:00', '20:00'],
      twitter: ['08:00', '19:00'],
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiFetch(`/api/brand?userId=${USER_ID}`, {
      method: 'POST',
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      toast.success('Perfil de marca guardado ✓');
      qc.invalidateQueries({ queryKey: ['brand-profile'] });
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const setTime = (platform: string, idx: number, value: string) => {
    setForm((f) => ({
      ...f,
      optimalTimes: {
        ...f.optimalTimes,
        [platform]: f.optimalTimes[platform].map((t, i) => (i === idx ? value : t)),
      },
    }));
  };

  const addTime = (platform: string) => {
    setForm((f) => ({
      ...f,
      optimalTimes: {
        ...f.optimalTimes,
        [platform]: [...(f.optimalTimes[platform] ?? []), '09:00'],
      },
    }));
  };

  const removeTime = (platform: string, idx: number) => {
    setForm((f) => ({
      ...f,
      optimalTimes: {
        ...f.optimalTimes,
        [platform]: f.optimalTimes[platform].filter((_, i) => i !== idx),
      },
    }));
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Perfil de Marca</h1>
        <p className="text-sm text-gray-400 mt-1">
          Esta información se usará en el futuro para generar captions automáticamente con IA.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-gray-200">Información básica</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre de marca</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              value={form.brandName}
              onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
              placeholder="Mi Marca"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nicho</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              value={form.niche}
              onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
              placeholder="Fitness, Tecnología, Moda…"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Tono de comunicación</label>
          <div className="flex gap-2 flex-wrap">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tone: t.value }))}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  form.tone === t.value
                    ? 'border-indigo-500 bg-indigo-950 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-gray-200">Vocabulario</h2>

        <TagInput
          label="Palabras que SIEMPRE usar"
          values={form.alwaysUseWords}
          onChange={(v) => setForm((f) => ({ ...f, alwaysUseWords: v }))}
          placeholder="Ej: exclusivo, innovador…"
        />
        <TagInput
          label="Palabras que NUNCA usar"
          values={form.neverUseWords}
          onChange={(v) => setForm((f) => ({ ...f, neverUseWords: v }))}
          placeholder="Ej: barato, malo…"
        />
        <TagInput
          label="Hashtags fijos"
          values={form.fixedHashtags}
          onChange={(v) => setForm((f) => ({ ...f, fixedHashtags: v }))}
          placeholder="Ej: mimarca (sin #)"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-200">Horarios óptimos por plataforma</h2>
        <p className="text-xs text-gray-500">Estos horarios se usarán automáticamente en la subida masiva.</p>

        {PLATFORMS_TIME.map((platform) => (
          <div key={platform} className="flex items-start gap-4">
            <span className="w-20 pt-2 text-sm font-medium text-gray-300 capitalize">{platform}</span>
            <div className="flex flex-wrap gap-2 flex-1">
              {(form.optimalTimes[platform] ?? []).map((time, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(platform, idx, e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                  {(form.optimalTimes[platform] ?? []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(platform, idx)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addTime(platform)}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium text-sm transition-colors"
      >
        {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Guardar perfil
      </button>
    </div>
  );
}
