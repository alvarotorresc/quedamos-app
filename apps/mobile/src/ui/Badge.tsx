import { HTMLAttributes } from 'react';

type BadgeVariant = 'confirmed' | 'pending' | 'cancelled' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  confirmed: 'bg-success text-on-primary',
  pending: 'bg-warning text-on-primary',
  cancelled: 'bg-error text-on-primary',
  neutral: 'border border-strong text-text bg-transparent',
};

export function Badge({
  variant = 'neutral',
  children,
  className = '',
  style,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${variantClasses[variant]} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
