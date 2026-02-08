import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export function Card({ selected, className = '', children, ...props }: CardProps) {
  const baseStyles = 'bg-bg-card border rounded-card p-3 mb-1.5 transition-all';
  const borderStyles = selected
    ? 'border-primary/25 bg-primary-dark/10'
    : 'border-white/5';

  return (
    <div className={`${baseStyles} ${borderStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}
