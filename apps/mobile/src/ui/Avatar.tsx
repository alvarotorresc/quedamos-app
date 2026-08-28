interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  color: string;
  size?: number;
  onClick?: () => void;
  /** @deprecated rediseño 1A: sin glow visual */
  pulse?: boolean;
}

const INK = '#33302A'; // tinta de día en AMBAS luces (spec §5.1): 4.8–6.8:1 sobre los 6 colores

export function Avatar({
  name,
  color,
  size = 32,
  onClick,
  className = '',
  pulse: _pulse,
  ...rest
}: AvatarProps) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
      : name.slice(0, 2).toUpperCase();

  const isClickable = !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`rounded-full flex items-center justify-center font-extrabold shrink-0 ${
        isClickable ? 'cursor-pointer active:scale-[0.92] transition-transform duration-150 select-none' : ''
      } ${className}`}
      style={{ width: size, height: size, background: color, color: INK, fontSize: size * 0.38 }}
      {...rest}
    >
      {initials}
    </div>
  );
}

export default Avatar;
