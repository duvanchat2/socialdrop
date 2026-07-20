'use client';
import { motion, HTMLMotionProps } from 'motion/react';

const staggerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

/** Orchestrated entrance container: children (e.g. FadeUp) enter one after another, not all at once. */
export function Stagger({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={staggerVariants} initial="hidden" animate="visible" {...props}>
      {children}
    </motion.div>
  );
}
