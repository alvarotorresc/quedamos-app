import { ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { DotLoader } from './DotLoader';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
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

const sizeClasses: Record<'sm' | 'md', string> = {
  md: 'px-5 py-3 text-sm',
  sm: 'px-4 py-2 text-xs',
};

export function Button({
  variant = 'primary',
  size = 'md',
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
        relative overflow-hidden rounded-pill
        font-bold
        transition-[filter] duration-150
        hover:brightness-105
        disabled:opacity-40 disabled:pointer-events-none
        ${sizeClasses[size]}
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
