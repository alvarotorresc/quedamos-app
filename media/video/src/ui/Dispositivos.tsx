import React from 'react';
import { Img, getStaticFiles, staticFile } from 'remotion';
import type { Lang } from '../copy';
import { COLOR, FUENTE } from './tema';

export type Slot = 'shot-01' | 'shot-02' | 'shot-03' | 'shot-04' | 'shot-05' | 'shot-06' | 'cover';

/** Ruta en public/ que deja `npm run preparar`. */
export const rutaShot = (lang: Lang, slot: Slot) => `shots/${lang}/${slot}.png`;

/** La captura si existe; si no, un bloque plano con el nombre del slot (solo para iterar en el studio). */
const Captura: React.FC<{ lang: Lang; slot: Slot; zoom?: number; origen?: string; opacidad?: number }> = ({
  lang,
  slot,
  zoom = 1,
  origen = '50% 50%',
  opacidad = 1,
}) => {
  const ruta = rutaShot(lang, slot);
  const existe = getStaticFiles().some((f) => f.name === ruta);
  const estilo: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${zoom})`,
    transformOrigin: origen,
    opacity: opacidad,
  };
  return existe ? (
    <Img src={staticFile(ruta)} style={estilo} />
  ) : (
    <div style={{ ...estilo, backgroundColor: COLOR.marco, color: COLOR.tenue, fontFamily: FUENTE, fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {slot}
    </div>
  );
};

export const PANTALLA_ANCHO = 1080;
export const PANTALLA_ALTO = 2340;

export const medidasPhone = (alto: number) => {
  const ancho = (alto * PANTALLA_ANCHO) / PANTALLA_ALTO;
  const marco = alto * 0.018;
  return { ancho, alto, marco, anchoTotal: ancho + 2 * marco, altoTotal: alto + 2 * marco, radio: alto * 0.05 };
};

export type CapaPhone = { slot: Slot; zoom?: number; origen?: string; opacidad?: number };

/** Marco del móvil sin marca: borde oscuro fino y pantalla recortada con lo que se le pase dentro. */
export const Marco: React.FC<{ alto: number; resalte?: number; style?: React.CSSProperties; pantalla?: React.CSSProperties; children: React.ReactNode }> = ({
  alto,
  resalte = 0,
  style,
  pantalla,
  children,
}) => {
  const m = medidasPhone(alto);
  return (
    <div
      style={{
        position: 'absolute',
        boxSizing: 'border-box',
        width: m.anchoTotal,
        height: m.altoTotal,
        padding: m.marco,
        borderRadius: m.radio + m.marco,
        backgroundColor: COLOR.marco,
        border: `1px solid ${COLOR.borde}`,
        boxShadow: `0 40px 90px rgba(0, 0, 0, 0.45), 0 0 0 ${resalte * 6}px rgba(52, 211, 153, ${resalte * 0.55})`,
        ...style,
      }}
    >
      <div style={{ position: 'relative', width: m.ancho, height: m.alto, borderRadius: m.radio, overflow: 'hidden', backgroundColor: COLOR.fondo, ...pantalla }}>
        {children}
      </div>
    </div>
  );
};

/** Móvil con una o varias capas de captura (la última encima). */
export const Phone: React.FC<{ lang: Lang; capas: CapaPhone[]; alto: number; resalte?: number; style?: React.CSSProperties }> = ({
  lang,
  capas,
  alto,
  resalte = 0,
  style,
}) => (
  <Marco alto={alto} resalte={resalte} style={style}>
    {capas.map((c, i) => (
      <Captura key={`${c.slot}-${i}`} lang={lang} slot={c.slot} zoom={c.zoom} origen={c.origen} opacidad={c.opacidad} />
    ))}
  </Marco>
);

/** Ventana de navegador sin URL ni texto: barra con tres puntos y la captura de escritorio (1600×1000). */
export const Navegador: React.FC<{ lang: Lang; ancho: number; style?: React.CSSProperties }> = ({ lang, ancho, style }) => {
  const barra = ancho * 0.035;
  const alto = (ancho * 1000) / 1600;
  return (
    <div
      style={{
        position: 'absolute',
        width: ancho,
        height: alto + barra,
        borderRadius: ancho * 0.014,
        overflow: 'hidden',
        backgroundColor: COLOR.marco,
        border: `1px solid ${COLOR.borde}`,
        boxShadow: '0 40px 90px rgba(0, 0, 0, 0.45)',
        ...style,
      }}
    >
      <div style={{ height: barra, display: 'flex', alignItems: 'center', gap: barra * 0.3, paddingLeft: barra * 0.5 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: barra * 0.32, height: barra * 0.32, borderRadius: '50%', backgroundColor: COLOR.borde }} />
        ))}
      </div>
      <div style={{ position: 'relative', width: ancho, height: alto }}>
        <Captura lang={lang} slot="cover" />
      </div>
    </div>
  );
};
