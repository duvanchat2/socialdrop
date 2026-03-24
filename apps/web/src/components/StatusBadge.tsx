export type PostStatus = 'DRAFT' | 'PENDING' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'ERROR';

const COLORS: Record<PostStatus, string> = {
  DRAFT: 'bg-gray-700 text-gray-300',
  PENDING: 'bg-yellow-900 text-yellow-300',
  SCHEDULED: 'bg-blue-900 text-blue-300',
  PUBLISHING: 'bg-purple-900 text-purple-300',
  PUBLISHED: 'bg-green-900 text-green-300',
  ERROR: 'bg-red-900 text-red-300',
};

const LABELS: Record<PostStatus, string> = {
  DRAFT: 'Borrador', PENDING: 'Pendiente', SCHEDULED: 'Programado',
  PUBLISHING: 'Publicando', PUBLISHED: 'Publicado', ERROR: 'Error',
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
