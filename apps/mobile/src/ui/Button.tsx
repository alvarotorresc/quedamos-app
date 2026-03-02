import { ButtonHTMLAttributes } from 'react';
import { IonSpinner } from '@ionic/react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'rounded-btn px-5 py-3 text-sm font-semibold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5';

  const variants = {
    primary: 'bg-primary-dark text-white shadow-lg shadow-primary-dark/25',
    secondary: 'bg-bg-input text-text-muted border border-strong',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <IonSpinner name="crescent" className="w-3 h-3 shrink-0" />}
      {children}
    </button>
  );
}
