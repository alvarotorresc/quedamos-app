import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'rounded-btn px-5 py-3 text-sm font-semibold transition-all disabled:opacity-50';

  const variants = {
    primary: 'bg-primary-dark text-white shadow-lg shadow-primary-dark/25',
    secondary: 'bg-bg-input text-text-muted border border-strong',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
