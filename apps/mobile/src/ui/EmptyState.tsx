import { motion } from 'framer-motion';
import { spring, useMotionSafe } from '../lib/motion';
import { Button } from './Button';

interface EmptyStateProps {
  emoji: string;
  title: string;
  description: string;
  action?: string;
  actionVariant?: 'primary' | 'accent' | 'success';
  onAction?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  emoji,
  title,
  description,
  action,
  actionVariant = 'primary',
  onAction,
  secondaryAction,
  onSecondaryAction,
}: EmptyStateProps) {
  const motionSafe = useMotionSafe();
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <motion.div
        initial={motionSafe ? { scale: 0, rotate: -12 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={motionSafe ? spring.bouncy : { duration: 0 }}
        className="text-6xl mb-4"
      >
        {emoji}
      </motion.div>
      <motion.h3
        initial={motionSafe ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={motionSafe ? { ...spring.gentle, delay: 0.2 } : { duration: 0 }}
        className="text-lg font-extrabold text-text mb-1.5"
      >
        {title}
      </motion.h3>
      <motion.p
        initial={motionSafe ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={motionSafe ? { ...spring.gentle, delay: 0.35 } : { duration: 0 }}
        className="text-sm text-text-muted max-w-[260px] leading-relaxed mb-5"
      >
        {description}
      </motion.p>
      {action && onAction && (
        <motion.div
          initial={motionSafe ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={motionSafe ? { ...spring.gentle, delay: 0.5 } : { duration: 0 }}
        >
          <Button variant={actionVariant} onClick={onAction}>
            {action}
          </Button>
        </motion.div>
      )}
      {secondaryAction && onSecondaryAction && (
        <motion.button
          initial={motionSafe ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={motionSafe ? { ...spring.gentle, delay: 0.6 } : { duration: 0 }}
          className="mt-3 text-xs text-primary font-bold"
          onClick={onSecondaryAction}
        >
          {secondaryAction}
        </motion.button>
      )}
    </div>
  );
}
