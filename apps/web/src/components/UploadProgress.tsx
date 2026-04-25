'use client';
import { Loader2 } from 'lucide-react';

interface Props {
  /** 'Comprimiendo' | 'Subiendo' | 'Listo' | 'Omitido' */
  stage: string;
  /** 0–100 */
  percent: number;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes — shown once available */
  compressedSize?: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function UploadProgress({ stage, percent, originalSize, compressedSize }: Props) {
  const isDone = stage === 'Listo';
  const isSkipped = stage === 'Omitido';
  const isCompressing = stage === 'Comprimiendo';
  const isUploading = stage === 'Subiendo';

  // Pill colour
  const pillClass = isDone
    ? 'bg-green-500/15 text-green-400 border-green-500/30'
    : isSkipped
    ? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
    : isCompressing
    ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    : 'bg-blue-500/15 text-blue-400 border-blue-500/30';

  // Progress bar colour
  const barClass = isDone
    ? 'bg-green-500'
    : isCompressing
    ? 'bg-orange-500'
    : 'bg-blue-500';

  // Label inside pill
  const pillLabel = isDone
    ? 'Listo ✓'
    : isSkipped
    ? 'Compresión omitida'
    : `${stage}… ${percent}%`;

  const showBar = !isDone && !isSkipped && (isCompressing || isUploading);
  const showReduction =
    compressedSize != null &&
    compressedSize < originalSize &&
    (isUploading || isDone);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Stage pill */}
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${pillClass}`}
        >
          {!isDone && !isSkipped && <Loader2 className="animate-spin shrink-0" size={9} />}
          {pillLabel}
        </span>

        {/* Size reduction badge */}
        {showReduction && (
          <span className="text-xs text-green-400 font-medium whitespace-nowrap">
            {fmtSize(originalSize)} → {fmtSize(compressedSize!)}{' '}
            <span className="text-green-500/80">
              ({Math.round((1 - compressedSize! / originalSize) * 100)}% más pequeño)
            </span>
          </span>
        )}

        {/* Fallback message when compression was skipped */}
        {isSkipped && (
          <span className="text-xs text-gray-500">subiendo original</span>
        )}
      </div>

      {/* Progress bar */}
      {showBar && (
        <div className="w-full bg-gray-700/60 rounded-full h-1.5 overflow-hidden">
          <div
            className={`${barClass} h-1.5 rounded-full transition-all duration-150`}
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </div>
      )}
    </div>
  );
}
