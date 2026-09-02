import type { HTMLAttributes, ReactNode } from 'react';
import { aroArc, aroStrokeWidth } from '../lib/aro-geometry';

export interface AroMember {
  color: string;
  state: 'on' | 'off' | 'apagado';
}

interface AroProps extends HTMLAttributes<HTMLDivElement> {
  members: AroMember[];
  size?: number;
  children?: ReactNode;
}

const R = 16;
const VIEWBOX = 40;
const CENTER = VIEWBOX / 2;

export function Aro({ members, size = 36, children, className = '', ...rest }: AroProps) {
  const n = members.length;
  const strokeWidth = aroStrokeWidth(n, R);
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} fill="none" aria-hidden="true">
        <circle cx={CENTER} cy={CENTER} r={R} stroke="var(--app-border)" strokeWidth={strokeWidth} />
        {members.map((m, i) => {
          if (m.state === 'off') return null;
          const { dasharray, rotate } = aroArc(n, i, R, {
            strokeWidth,
            short: m.state === 'apagado',
          });
          return (
            <circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={R}
              stroke={m.state === 'apagado' ? 'var(--app-apagado)' : m.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={dasharray}
              transform={`rotate(${rotate.toFixed(2)} ${CENTER} ${CENTER})`}
            />
          );
        })}
      </svg>
      {children != null && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-text-muted">
          {children}
        </div>
      )}
    </div>
  );
}
