'use client';
import { Loader2 } from 'lucide-react';

interface Props {
  /** 'uploading' | 'done' */
  stage: 'uploading' | 'done';
  /** 0–100 */
  percent: number;
  /** e.g. "2.3 MB/s" */
  speed?: string;
  /** e.g. "~12s restantes" */
  remaining?: string;
  /** Original file size in bytes */
  originalSize: number;
}

export function UploadProgress({ stage, percent, speed, remaining, originalSize }: Props) {
  const isDone = stage === 'done';

  return (
    <div className="space-y-1">
      {isDone ? (
        <p className="text-[10px] text-green-400 font-medium">Subido ✓</p>
      ) : (
        <>
          <p className="text-[10px] text-blue-300 flex items-center gap-1 flex-wrap">
            <Loader2 className="animate-spin shrink-0" size={9} />
            <span>
              Subiendo… {percent}%
              {speed && <span className="text-gray-400"> • {speed}</span>}
              {remaining && <span className="text-gray-500"> • {remaining}</span>}
            </span>
          </p>
          <div className="w-full bg-gray-700/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-150"
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
