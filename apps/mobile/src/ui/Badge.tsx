import { HTMLAttributes } from 'react';

type BadgeVariant = 'confirmed' | 'pending' | 'cancelled' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
  variant?: BadgeVariant;
  glow?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  confirmed: 'bg-success text-on-primary',
  pending: 'bg-warning text-on-primary',
  cancelled: 'bg-error text-on-primary',
  neutral: 'border border-strong text-text bg-transparent',
};

export function Badge({
  color,
  variant,
  glow = false,
  children,
  className = '',
  style,
  ...props
}: BadgeProps) {
  if (variant) {
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

  const baseAlpha = glow ? '40' : '2E';
  const endAlpha = glow ? '1F' : '14';
  const borderAlpha = glow ? '4D' : '33';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide ${className}`}
      style={{
        background: `linear-gradient(135deg, ${color}${baseAlpha}, ${color}${endAlpha})`,
        border: `1px solid ${color}${borderAlpha}`,
        color,
        boxShadow: glow ? `0 0 10px ${color}26` : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
