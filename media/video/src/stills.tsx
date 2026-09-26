import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { PromoProps } from './copy';
import { Phone, medidasPhone } from './ui/Dispositivos';
import type { Slot } from './ui/Dispositivos';
import { Logo } from './ui/Logo';
import { Fondo, Rotulo } from './ui/tema';

// Medidas a escala 1 (still de 1920×1080); la feature graphic las reduce con `escala`.
const LOGO = 132;
const TITULO = 96;
const HUECO_TITULO = 28;
const HUECO_COLUMNAS = 150;
const PHONE_CENTRO = 760;
const PHONE_LADO = 620;
const SOLAPE_LADO = 0.38; // parte de cada móvil lateral que queda detrás del central
const BAJADA_LADO = 50; // los laterales, algo más abajo que el central
const BRILLO_LADO = 0.72; // los laterales, un punto más oscuros para dar fondo

/**
 * Dos columnas centradas en el lienzo: marca (logo sobre «Quedamos») a la izquierda,
 * centrada en vertical; a la derecha tres móviles escalonados: quedada detrás a la
 * izquierda, grupo detrás a la derecha y calendario delante en el centro. Sin texto pequeño.
 */
const Composicion: React.FC<PromoProps & { escala: number }> = ({ lang, escala }) => {
  const centro = medidasPhone(PHONE_CENTRO * escala);
  const lado = medidasPhone(PHONE_LADO * escala);
  const asoma = lado.anchoTotal * (1 - SOLAPE_LADO);
  const grupoAncho = centro.anchoTotal + 2 * asoma;
  const grupoAlto = centro.altoTotal;
  const topLado = (grupoAlto - lado.altoTotal) / 2 + BAJADA_LADO * escala;
  const lateral = (slot: Slot, izquierda: boolean) => (
    <Phone
      lang={lang}
      alto={PHONE_LADO * escala}
      capas={[{ slot }]}
      style={{ top: topLado, filter: `brightness(${BRILLO_LADO})`, ...(izquierda ? { left: 0 } : { right: 0 }) }}
    />
  );
  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: HUECO_COLUMNAS * escala }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: HUECO_TITULO * escala, flexShrink: 0 }}>
          <Logo tamano={LOGO * escala} />
          <Rotulo entra={-30} tamano={TITULO * escala} peso={800} style={{ position: 'relative' }}>
            Quedamos
          </Rotulo>
        </div>
        <div style={{ position: 'relative', width: grupoAncho, height: grupoAlto, flexShrink: 0 }}>
          {lateral('shot-04', true)}
          {lateral('shot-05', false)}
          <Phone lang={lang} alto={PHONE_CENTRO * escala} capas={[{ slot: 'shot-01' }]} style={{ left: asoma, top: 0 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Still de marketing 1920×1080. */
export const Promo: React.FC<PromoProps> = ({ lang }) => <Composicion lang={lang} escala={1} />;

/** Feature graphic de Play 1024×500: la misma maqueta con medidas propias, no el promo encogido. */
export const FeatureGraphic: React.FC<PromoProps> = ({ lang }) => <Composicion lang={lang} escala={0.5} />;
