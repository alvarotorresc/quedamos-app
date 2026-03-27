import { motion } from 'framer-motion';
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
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <motion.div
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 15 }}
        className="text-6xl mb-4"
      >
        {emoji}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-lg font-extrabold text-text mb-1.5"
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="text-sm text-text-muted max-w-[260px] leading-relaxed mb-5"
      >
        {description}
      </motion.p>
      {action && onAction && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Button variant={actionVariant} onClick={onAction}>
            {action}
          </Button>
        </motion.div>
      )}
      {secondaryAction && onSecondaryAction && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-3 text-xs text-primary font-bold"
          onClick={onSecondaryAction}
        >
          {secondaryAction}
        </motion.button>
      )}
    </div>
  );
}
