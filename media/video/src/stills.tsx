import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { PromoProps } from './copy';
import { Navegador, Phone, medidasPhone } from './ui/Dispositivos';
import { Logo } from './ui/Logo';
import { Fondo, Rotulo } from './ui/tema';

// Medidas a escala 1 (still de 1920×1080); la feature graphic las reduce con `escala`.
const LOGO = 132;
const TITULO = 96;
const HUECO_TITULO = 28;
const HUECO_COLUMNAS = 110;
const NAVEGADOR = 900;
const PHONE = 700;
const SOLAPE_PHONE = 0.42; // parte del móvil que queda por delante del navegador

/**
 * Dos columnas centradas en el lienzo: marca (logo sobre «Quedamos») a la izquierda,
 * centrada en vertical; a la derecha el navegador con `cover` y el móvil con `shot-01`
 * por delante de su borde izquierdo. Sin texto pequeño.
 */
const Composicion: React.FC<PromoProps & { escala: number }> = ({ lang, escala }) => {
  const phone = medidasPhone(PHONE * escala);
  const navegador = NAVEGADOR * escala;
  const navegadorAlto = (navegador * 1000) / 1600 + navegador * 0.035;
  const grupoAncho = phone.anchoTotal * (1 - SOLAPE_PHONE) + navegador;
  const grupoAlto = Math.max(phone.altoTotal, navegadorAlto);
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
          <Navegador lang={lang} ancho={navegador} style={{ right: 0, top: (grupoAlto - navegadorAlto) / 2 }} />
          <Phone lang={lang} alto={PHONE * escala} capas={[{ slot: 'shot-01' }]} style={{ left: 0, top: (grupoAlto - phone.altoTotal) / 2 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Still de marketing 1920×1080. */
export const Promo: React.FC<PromoProps> = ({ lang }) => <Composicion lang={lang} escala={1} />;

/** Feature graphic de Play 1024×500: la misma maqueta con medidas propias, no el promo encogido. */
export const FeatureGraphic: React.FC<PromoProps> = ({ lang }) => <Composicion lang={lang} escala={0.5} />;
