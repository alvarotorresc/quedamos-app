import React from 'react';
import { MIEMBRO } from './tema';

// Geometría del aro copiada de apps/mobile/src/lib/aro-geometry.ts (radio grande) y del Logo de
// apps/mobile/src/ui/Logo.tsx: seis huecos, cinco arcos y el punto en el hueco de abajo.
const RADIO = 100;
const GROSOR = 20;
const HUECOS = 6;
const SLOTS = [0, 1, 2, 4, 5] as const;
const COLORES = [MIEMBRO.blue, MIEMBRO.orange, MIEMBRO.pink, MIEMBRO.green, MIEMBRO.red] as const;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
const TRAMO = CIRCUNFERENCIA / HUECOS;
const ARCO = Math.max(TRAMO - GROSOR - Math.min(TRAMO * 0.3, 13), 1);

const giro = (slot: number) => -90 + slot * (360 / HUECOS) - (ARCO / CIRCUNFERENCIA) * 180;

/**
 * Logo aro. `dibujo` va de 0 a 1: cada arco crece desde su inicio hasta su largo completo, uno tras
 * otro con solape, y el punto aparece al final. Con 1 es idéntico al logo de la app.
 */
export const Logo: React.FC<{ tamano: number; dibujo?: number; style?: React.CSSProperties }> = ({ tamano, dibujo = 1, style }) => (
  <svg width={tamano} height={tamano} viewBox="-120 -120 240 240" style={style} aria-hidden="true">
    {SLOTS.map((slot, i) => {
      const propio = Math.min(1, Math.max(0, dibujo * 1.6 - i * 0.15));
      const largo = ARCO * propio;
      return (
        <circle
          key={slot}
          cx={0}
          cy={0}
          r={RADIO}
          fill="none"
          stroke={COLORES[i]}
          strokeWidth={GROSOR}
          strokeLinecap="round"
          strokeDasharray={`${largo.toFixed(2)} ${(CIRCUNFERENCIA - largo).toFixed(2)}`}
          opacity={propio > 0 ? 1 : 0}
          transform={`rotate(${giro(slot).toFixed(2)})`}
        />
      );
    })}
    <circle cx={0} cy={106} r={13 * Math.min(1, Math.max(0, (dibujo - 0.8) / 0.2))} fill={MIEMBRO.purple} />
  </svg>
);
