import { ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { DotLoader } from './DotLoader';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'ghost';
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary-solid text-on-primary rounded-pill',
  accent: 'bg-text text-bg',
  success: 'bg-success text-on-primary',
  danger: 'bg-error text-on-primary',
  secondary: 'border-[1.5px] border-strong text-text rounded-pill bg-transparent',
  ghost: 'text-text-muted',
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
        relative overflow-hidden rounded-pill px-5 py-3
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
