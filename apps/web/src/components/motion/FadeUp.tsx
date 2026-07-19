'use client';
import { motion, HTMLMotionProps } from 'motion/react';

const fadeUpVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/** Standard card entrance: opacity 0→1, y 12→0. Duration/easing mirror --duration-enter / --ease-out. */
export function FadeUp({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
