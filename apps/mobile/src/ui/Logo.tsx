import { aroArc } from '../lib/aro-geometry';

export interface LogoProps {
  size?: number;
  variant?: 'color' | 'mono';
  className?: string;
}

const RADIUS = 100;
const STROKE_WIDTH = 20;
const RING_SIZE = 6;
// Aro de 6 miembros con el hueco abierto abajo (slot 3): los arcos ocupan
// los otros 5 índices. El sexto color (el hueco) lo rellena el punto.
const MEMBER_SLOTS = [0, 1, 2, 4, 5] as const;
const ARC_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#FB7185'] as const;
const DOT_COLOR_MULTICOLOR = '#A78BFA';
const DOT_COLOR_MONO = '#60A5FA';

export function Logo({ size = 24, variant = 'color', className }: LogoProps): JSX.Element {
  const dotFill = variant === 'mono' ? DOT_COLOR_MONO : DOT_COLOR_MULTICOLOR;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-120 -120 240 240"
      className={className}
      aria-hidden="true"
    >
      <g>
        {MEMBER_SLOTS.map((slot, i) => {
          const { dasharray, rotate } = aroArc(RING_SIZE, slot, RADIUS, {
            strokeWidth: STROKE_WIDTH,
          });
          return (
            <circle
              key={slot}
              cx={0}
              cy={0}
              r={RADIUS}
              fill="none"
              stroke={variant === 'mono' ? 'currentColor' : ARC_COLORS[i]}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={dasharray}
              transform={`rotate(${rotate.toFixed(2)})`}
            />
          );
        })}
        <circle cx={0} cy={106} r={13} fill={dotFill} />
      </g>
    </svg>
  );
}
