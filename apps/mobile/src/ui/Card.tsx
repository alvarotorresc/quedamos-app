import { HTMLAttributes } from 'react';

type CardVariant = 'default' | 'success' | 'pending' | 'cancelled' | 'highlight' | 'selected';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  selected?: boolean;
  memberColor?: string;
}

const variantBorders: Record<CardVariant, string> = {
  default: 'border-subtle',
  success: 'border-subtle',
  pending: 'border-subtle',
  cancelled: 'border-subtle opacity-60',
  highlight: 'border-transparent bg-primary-solid text-on-primary',
  selected: 'border-transparent',
};

export function Card({
  variant = 'default',
  selected = false,
  memberColor,
  children,
  className = '',
  ...props
}: CardProps) {
  const borderClass = selected ? 'border-subtle bg-primary-tint' : variantBorders[variant];

  return (
    <div
      className={`
        bg-bg-light relative overflow-hidden
        border rounded-lg p-3 mb-2.5
        transition-all duration-200
        ${borderClass}
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      style={
        variant === 'selected' && memberColor ? { borderColor: `${memberColor}4D` } : undefined
      }
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export default Card;
