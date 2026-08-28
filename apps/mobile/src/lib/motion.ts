import { useReducedMotion } from 'framer-motion';

export const spring = {
  gentle: { type: 'spring', stiffness: 170, damping: 20 },
  snappy: { type: 'spring', stiffness: 380, damping: 26 },
  bouncy: { type: 'spring', stiffness: 300, damping: 15 },
} as const;

export function useMotionSafe(): boolean {
  return !useReducedMotion();
}
