import { Check, Circle, AlertTriangle, Minus, Play, LucideIcon } from 'lucide-react';

export type PostStatus = 'DRAFT' | 'PENDING' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'ERROR';

const STYLES: Record<PostStatus, { icon: LucideIcon; className: string; pulse?: boolean }> = {
  DRAFT:      { icon: Minus,         className: 'bg-surface-2 text-ink-muted' },
  PENDING:    { icon: Minus,         className: 'bg-surface-2 text-ink-muted' },
  SCHEDULED:  { icon: Circle,        className: 'bg-accent/15 text-accent' },
  PUBLISHING: { icon: Play,          className: 'bg-accent/15 text-accent', pulse: true },
  PUBLISHED:  { icon: Check,         className: 'bg-positive/15 text-positive' },
  ERROR:      { icon: AlertTriangle, className: 'bg-warning/15 text-warning' },
};

const LABELS: Record<PostStatus, string> = {
  DRAFT: 'Borrador', PENDING: 'Pendiente', SCHEDULED: 'Programado',
  PUBLISHING: 'Publicando', PUBLISHED: 'Publicado', ERROR: 'Error',
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const { icon: Icon, className, pulse } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium ${className} ${pulse ? 'animate-pulse' : ''}`}>
      <Icon size={11} strokeWidth={2.5} />
      {LABELS[status]}
    </span>
  );
}
