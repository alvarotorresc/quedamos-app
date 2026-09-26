import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { PromoProps } from './copy';
import { ALTO, ANCHO } from './timing';
import { Navegador, Phone } from './ui/Dispositivos';
import { Logo } from './ui/Logo';
import { Fondo, Rotulo } from './ui/tema';

/** Still de marketing 1920×1080: navegador con `cover` detrás y móvil con `shot-01` delante; sin texto pequeño. */
export const Promo: React.FC<PromoProps> = ({ lang }) => (
  <AbsoluteFill>
    <Fondo />
    <Logo tamano={120} style={{ position: 'absolute', left: 120, top: 110 }} />
    <Rotulo entra={-30} tamano={96} peso={800} style={{ left: 270, top: 118 }}>
      Quedamos
    </Rotulo>
    <Navegador lang={lang} ancho={1180} style={{ left: 620, top: 220 }} />
    <Phone lang={lang} alto={760} capas={[{ slot: 'shot-01' }]} style={{ left: 250, top: 250 }} />
  </AbsoluteFill>
);

const FG_ANCHO = 1024;
const FG_ALTO = 500;
const ESCALA_FG = Math.min((FG_ANCHO * 0.9) / ANCHO, (FG_ALTO * 0.9) / ALTO);

/** Feature graphic de Play 1024×500: la misma composición, reducida y centrada con margen. */
export const FeatureGraphic: React.FC<PromoProps> = ({ lang }) => (
  <AbsoluteFill>
    <Fondo />
    <div
      style={{
        position: 'absolute',
        left: (FG_ANCHO - ANCHO * ESCALA_FG) / 2,
        top: (FG_ALTO - ALTO * ESCALA_FG) / 2,
        width: ANCHO,
        height: ALTO,
        transform: `scale(${ESCALA_FG})`,
        transformOrigin: '0 0',
      }}
    >
      <Promo lang={lang} />
    </div>
  </AbsoluteFill>
);
