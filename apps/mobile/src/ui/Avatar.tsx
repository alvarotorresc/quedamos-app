interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export function Avatar({ name, color, size = 32 }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.35,
        background: `${color}18`,
        border: `1.5px solid ${color}35`,
        fontSize: size * 0.35,
        color,
      }}
    >
      {initial}
    </div>
  );
}
