import { HTMLAttributes } from 'react';

type CardVariant = 'default' | 'success' | 'pending' | 'cancelled' | 'highlight' | 'selected';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  selected?: boolean;
  memberColor?: string;
}

const variantBorders: Record<CardVariant, string> = {
  default: 'border-strong',
  success: 'border-[rgba(52,211,153,0.2)]',
  pending: 'border-[rgba(251,191,36,0.15)]',
  cancelled: 'border-[rgba(251,113,133,0.15)] opacity-60',
  highlight: 'border-transparent',
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
  const borderClass = selected ? 'border-primary/25 bg-primary-dark/10' : variantBorders[variant];

  return (
    <div
      className={`
        card-glass relative overflow-hidden
        bg-bg-glass backdrop-blur-[16px]
        border rounded-card p-3 mb-2.5
        transition-all duration-200
        ${borderClass}
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      style={
        variant === 'selected' && memberColor
          ? { borderColor: `${memberColor}4D`, boxShadow: `0 0 16px ${memberColor}14` }
          : undefined
      }
      {...props}
    >
      <div className="absolute inset-0 rounded-card bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />

      {variant === 'highlight' && (
        <div
          className="absolute inset-0 rounded-card pointer-events-none"
          style={{
            padding: '1px',
            background: 'linear-gradient(135deg, rgba(167,139,250,0.4), rgba(244,114,182,0.3))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export default Card;
