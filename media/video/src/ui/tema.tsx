import { loadFont as cargarBricolage } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as cargarGeistMono } from '@remotion/google-fonts/GeistMono';
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { TRANSICION } from '../timing';

// Mismo origen que la app (Google Fonts en apps/mobile/index.html).
const bricolage = cargarBricolage('normal', { weights: ['400', '600', '700', '800'], subsets: ['latin', 'latin-ext'] });
const geistMono = cargarGeistMono('normal', { weights: ['400', '500'], subsets: ['latin'] });

export const FUENTE = bricolage.fontFamily;
export const MONO = geistMono.fontFamily;

// Paleta cálida de apps/mobile/src/index.css y colores de miembro de apps/mobile/tailwind.config.js.
export const COLOR = {
  fondo: '#14120E',
  crema: '#F2EFE7',
  tenue: 'rgba(242, 239, 231, 0.62)',
  borde: 'rgba(242, 239, 231, 0.10)',
  marco: '#26221B',
} as const;

export const MIEMBRO = {
  blue: '#60A5FA',
  orange: '#F59E0B',
  pink: '#F472B6',
  green: '#34D399',
  purple: '#A78BFA',
  red: '#FB7185',
} as const;

export const SALIDA = Easing.bezier(0.22, 0.61, 0.36, 1);
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Progreso 0→1 de una transición que empieza en `desde` y dura `TRANSICION` frames, sin rebote. */
export const progreso = (frame: number, desde: number, duracion: number = TRANSICION) =>
  interpolate(frame, [desde, desde + duracion], [0, 1], { ...CLAMP, easing: SALIDA });

export const Fondo: React.FC = () => <AbsoluteFill style={{ backgroundColor: COLOR.fondo }} />;

export type RotuloProps = {
  children: React.ReactNode;
  entra?: number;
  sale?: number;
  tamano?: number;
  peso?: 400 | 500 | 600 | 700 | 800;
  color?: string;
  mono?: boolean;
  alinear?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
};

export const Rotulo: React.FC<RotuloProps> = ({
  children,
  entra = 0,
  sale,
  tamano = 72,
  peso = 700,
  color = COLOR.crema,
  mono = false,
  alinear = 'left',
  style,
}) => {
  const frame = useCurrentFrame();
  const dentro = progreso(frame, entra);
  const fuera = sale === undefined ? 1 : 1 - progreso(frame, sale);
  return (
    <div
      style={{
        position: 'absolute',
        fontFamily: mono ? MONO : FUENTE,
        fontSize: tamano,
        fontWeight: peso,
        lineHeight: 1.12,
        letterSpacing: mono ? '0' : '-0.02em',
        color,
        textAlign: alinear,
        opacity: dentro * fuera,
        transform: `translateY(${(1 - dentro) * 20}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
