'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Check } from 'lucide-react';

export function OnboardingChecklist({ userId, hasPosts }: { userId: string; hasPosts: boolean }) {
  const integrations = useQuery({
    queryKey: ['onboarding-integrations'],
    queryFn: () => apiFetch<unknown[]>(`/api/integrations?userId=${userId}`),
  });
  const queue = useQuery({
    queryKey: ['onboarding-queue'],
    queryFn: () => apiFetch<unknown[]>(`/api/queue?userId=${userId}&platform=INSTAGRAM`),
  });

  if (integrations.isLoading || queue.isLoading) return null;

  const steps = [
    { label: 'Conecta una cuenta', done: (integrations.data?.length ?? 0) > 0, href: '/integrations' },
    { label: 'Define tu cola de publicación', done: (queue.data?.length ?? 0) > 0, href: '/queue' },
    { label: 'Crea tu primer post', done: hasPosts, href: '/posts/new' },
  ];

  if (steps.every((s) => s.done)) return null;

  return (
    <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-indigo-200 mb-3">Empieza en 3 pasos</h3>
      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 transition-colors ${
              step.done ? 'text-gray-500' : 'text-gray-200 hover:bg-indigo-900/40'
            }`}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full border shrink-0 ${
                step.done ? 'bg-green-600 border-green-600' : 'border-gray-600'
              }`}
            >
              {step.done && <Check size={12} className="text-white" />}
            </span>
            <span className={step.done ? 'line-through' : ''}>{step.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
