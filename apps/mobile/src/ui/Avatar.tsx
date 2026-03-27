import { MEMBER_COLORS, MEMBER_GRADIENTS, MEMBER_GLOWS } from '../lib/constants';

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  onClick?: () => void;
  className?: string;
  pulse?: boolean;
}

export function Avatar({
  name,
  color,
  size = 32,
  onClick,
  className = '',
  pulse = false,
}: AvatarProps) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
      : name.slice(0, 2).toUpperCase();

  const colorIndex = MEMBER_COLORS.indexOf(color as (typeof MEMBER_COLORS)[number]);
  const gradient =
    colorIndex >= 0 ? MEMBER_GRADIENTS[colorIndex] : `linear-gradient(135deg, ${color}, ${color})`;
  const glow = colorIndex >= 0 ? MEMBER_GLOWS[colorIndex] : `${color}4D`;

  const isClickable = !!onClick;

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      className={`
        flex items-center justify-center font-bold shrink-0 select-none
        transition-transform duration-150
        ${isClickable ? 'cursor-pointer active:scale-[0.92]' : ''}
        ${pulse ? 'animate-[glow-pulse_2.5s_ease-in-out_infinite]' : ''}
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: gradient,
        fontSize: size * 0.35,
        color: 'white',
        boxShadow: pulse ? undefined : `0 0 8px ${glow}`,
        ...({
          '--glow-color': glow,
          '--glow-soft': glow.replace('0.3', '0.12'),
        } as React.CSSProperties),
      }}
    >
      {initials}
    </div>
  );
}

export default Avatar;
