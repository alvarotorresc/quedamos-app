interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  onClick?: () => void;
  className?: string;
}

export function Avatar({ name, color, size = 32, onClick, className }: AvatarProps) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`flex items-center justify-center font-bold shrink-0 ${className ?? ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        width: size,
        height: size,
        boxSizing: 'border-box',
        borderRadius: size * 0.35,
        background: `${color}18`,
        border: `1.5px solid ${color}35`,
        fontSize: size * 0.3,
        color,
      }}
    >
      {initials}
    </div>
  );
}
