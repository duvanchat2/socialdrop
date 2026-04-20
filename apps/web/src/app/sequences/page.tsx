'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { ListOrdered, Plus, Trash2, Clock, MessageSquare } from 'lucide-react';

interface SequenceStep {
  message: string;
  delayHours: number;
}

interface Sequence {
  id: string;
  name: string;
  nodes: SequenceStep[];
  isActive: boolean;
  createdAt: string;
}

export default function SequencesPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<SequenceStep[]>([
    { message: '', delayHours: 0 },
  ]);

  const { data: sequences = [], isLoading } = useQuery<Sequence[]>({
    queryKey: ['sequences'],
    queryFn: () => apiFetch('/api/sequences'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, steps }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); setCreating(false); setName(''); setSteps([{ message: '', delayHours: 0 }]); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/sequences/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sequences'] }),
  });

  const addStep = () => setSteps(prev => [...prev, { message: '', delayHours: 24 }]);
  const removeStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: keyof SequenceStep, value: any) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ListOrdered className="text-indigo-500" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Secuencias</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Campañas drip — DMs automáticos con delays</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nueva secuencia
        </button>
      </div>

      {creating && (
        <div className="mb-6 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <h2 className="font-semibold mb-4 text-gray-900 dark:text-white">Nueva secuencia</h2>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre de la secuencia"
            className="w-full mb-4 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          />

          <div className="space-y-3 mb-4">
            {steps.map((step, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Paso {i + 1}
                  </span>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={13} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-400">Enviar después de</span>
                  <input
                    type="number"
                    min={0}
                    value={step.delayHours}
                    onChange={e => updateStep(i, 'delayHours', Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white text-center"
                  />
                  <span className="text-xs text-gray-400">horas</span>
                </div>
                <textarea
                  rows={2}
                  value={step.message}
                  onChange={e => updateStep(i, 'message', e.target.value)}
                  placeholder="Mensaje del DM..."
                  className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white resize-none"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={addStep}
              className="flex items-center gap-1.5 px-3 py-2 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <Plus size={14} /> Paso
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name || steps.some(s => !s.message) || createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Cargando...</div>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-gray-400 dark:text-gray-600 gap-3">
          <ListOrdered size={40} />
          <p className="text-sm">No hay secuencias. Crea una para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => {
            const stepNodes: SequenceStep[] = Array.isArray(seq.nodes) ? seq.nodes as SequenceStep[] : [];
            return (
              <div key={seq.id} className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ListOrdered size={16} className="text-indigo-500" />
                    <h3 className="font-medium text-gray-900 dark:text-white">{seq.name}</h3>
                    <span className="text-xs text-gray-400">{stepNodes.length} pasos</span>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(seq.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {stepNodes.map((step, i) => (
                    <div key={i} className="flex-shrink-0 flex items-start gap-1.5">
                      {i > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                          <Clock size={11} /> {step.delayHours}h →
                        </div>
                      )}
                      <div className="w-40 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-1 mb-1">
                          <MessageSquare size={12} className="text-indigo-400" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Paso {i + 1}</span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{step.message || '(sin mensaje)'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
