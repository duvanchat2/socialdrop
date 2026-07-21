'use client';
import { useEffect, useRef } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';

interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

/** Count-up on mount: 0 → value over `duration`ms with --ease-out. Renders the
 * final value immediately (no animation) when prefers-reduced-motion is set. */
export function CountUp({ value, duration = 0.6, format = (n) => Math.round(n).toLocaleString('es-CO'), className }: CountUpProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!nodeRef.current) return;

    if (reducedMotion) {
      nodeRef.current.textContent = format(value);
      return;
    }

    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // --ease-out
      onUpdate: (v) => {
        if (nodeRef.current) nodeRef.current.textContent = format(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reducedMotion]);

  return <span ref={nodeRef} className={className}>{format(0)}</span>;
}
