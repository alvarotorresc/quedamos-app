import { ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { DotLoader } from './DotLoader';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'ghost';
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white',
  accent: 'bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white',
  success: 'bg-gradient-to-br from-[#34D399] to-[#10B981] text-white',
  danger: 'bg-gradient-to-br from-[#FB7185] to-[#E11D48] text-white',
  secondary: 'bg-bg-surface text-text-muted border border-strong',
  ghost: 'bg-transparent text-text-muted',
};

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={`
        relative overflow-hidden rounded-btn px-5 py-3
        font-bold text-sm
        transition-[filter] duration-150
        hover:brightness-105
        disabled:opacity-40 disabled:pointer-events-none
        ${variantClasses[variant] ?? variantClasses.primary}
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      disabled={loading || disabled}
      {...(props as Record<string, unknown>)}
    >
      {loading ? <DotLoader /> : children}
    </motion.button>
  );
}

export default Button;
