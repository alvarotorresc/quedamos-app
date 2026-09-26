import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { texto, type PromoProps } from './copy';
import { escena } from './timing';
import { Navegador, Phone, medidasPhone } from './ui/Dispositivos';
import { Logo } from './ui/Logo';
import { COLOR, MIEMBRO, Rotulo, progreso } from './ui/tema';

const ALTO_PHONE = 860;
const RESPUESTAS = [MIEMBRO.blue, MIEMBRO.orange, MIEMBRO.pink, MIEMBRO.green, MIEMBRO.purple] as const;

/** El móvil entra desde abajo con un desplazamiento corto y fundido. */
const entrada = (frame: number, desde = 0) => {
  const p = progreso(frame, desde);
  return { opacity: p, translate: (1 - p) * 40 };
};

/** Columna de texto a la derecha del móvil. */
const COLUMNA_IZQ = 900;
const COLUMNA: React.CSSProperties = { left: COLUMNA_IZQ, width: 860, top: 430 };

export const Escena1Intro: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Logo tamano={300} dibujo={progreso(frame, 0, 36)} style={{ position: 'absolute', left: 810, top: 170 }} />
      <Rotulo entra={30} tamano={120} peso={800} alinear="center" style={{ left: 0, right: 0, top: 500 }}>
        Quedamos
      </Rotulo>
      <Rotulo entra={50} tamano={56} peso={600} color={COLOR.tenue} alinear="center" style={{ left: 0, right: 0, top: 680 }}>
        {texto(lang, 'intro.eslogan')}
      </Rotulo>
    </AbsoluteFill>
  );
};

export const Escena2Calendario: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  const e = entrada(frame);
  const zoom = interpolate(frame, [20, escena(2).duracion], [1, 1.22], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Phone
        lang={lang}
        alto={ALTO_PHONE}
        capas={[{ slot: 'shot-01', zoom, origen: '50% 42%' }]}
        style={{ left: 420, top: 94 + e.translate, opacity: e.opacity }}
      />
      <Rotulo entra={12} tamano={76} style={COLUMNA}>
        {texto(lang, 'calendario.rotulo')}
      </Rotulo>
    </AbsoluteFill>
  );
};

export const Escena3Proponer: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  const e = entrada(frame);
  const cambio = progreso(frame, 60);
  return (
    <AbsoluteFill>
      <Phone
        lang={lang}
        alto={ALTO_PHONE}
        capas={[{ slot: 'shot-02' }, { slot: 'shot-03', opacidad: cambio }]}
        style={{ left: 420, top: 94 + e.translate, opacity: e.opacity }}
      />
      <Rotulo entra={12} tamano={76} style={COLUMNA}>
        {texto(lang, 'proponer.rotulo')}
      </Rotulo>
      {RESPUESTAS.map((color, i) => {
        const p = progreso(frame, 72 + i * 9);
        return (
          <div
            key={color}
            style={{
              position: 'absolute',
              left: COLUMNA_IZQ + i * 84,
              top: 640 + (1 - p) * 16,
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: `8px solid ${color}`,
              boxSizing: 'border-box',
              opacity: p,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Escena4Fijada: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  const e = entrada(frame);
  const resalte = progreso(frame, 40, 12);
  return (
    <AbsoluteFill>
      <Phone
        lang={lang}
        alto={ALTO_PHONE}
        capas={[{ slot: 'shot-04' }]}
        resalte={resalte}
        style={{ left: 420, top: 94 + e.translate, opacity: e.opacity, transform: `scale(${1 + resalte * 0.03})` }}
      />
      <Rotulo entra={12} tamano={76} style={COLUMNA}>
        {texto(lang, 'fijada.rotulo')}
      </Rotulo>
    </AbsoluteFill>
  );
};

export const Escena5Navegacion: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  const alto = 700;
  const m = medidasPhone(alto);
  const ANCHO_NAV = 940;
  const hueco = 56;
  const inicio = (1920 - (2 * m.anchoTotal + ANCHO_NAV + 2 * hueco)) / 2;
  const top = 260;
  const lateral = (desde: number) => {
    const p = progreso(frame, desde);
    return { opacity: p, transform: `translateX(${(1 - p) * 60}px)` };
  };
  return (
    <AbsoluteFill>
      <Rotulo entra={0} tamano={64} alinear="center" style={{ left: 0, right: 0, top: 110 }}>
        {texto(lang, 'navegacion.rotulo')}
      </Rotulo>
      <Phone lang={lang} alto={alto} capas={[{ slot: 'shot-05' }]} style={{ left: inicio, top, ...lateral(8) }} />
      <Phone lang={lang} alto={alto} capas={[{ slot: 'shot-06' }]} style={{ left: inicio + m.anchoTotal + hueco, top, ...lateral(20) }} />
      <Navegador lang={lang} ancho={ANCHO_NAV} style={{ left: inicio + 2 * (m.anchoTotal + hueco), top: top + 90, ...lateral(32) }} />
    </AbsoluteFill>
  );
};

export const Escena6Cierre: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Logo tamano={240} dibujo={progreso(frame, 0, 24)} style={{ position: 'absolute', left: 840, top: 170 }} />
      <Rotulo entra={14} tamano={112} peso={800} alinear="center" style={{ left: 0, right: 0, top: 450 }}>
        Quedamos
      </Rotulo>
      <Rotulo entra={28} tamano={48} mono peso={500} color={MIEMBRO.blue} alinear="center" style={{ left: 0, right: 0, top: 620 }}>
        quedamos.alvarotc.com
      </Rotulo>
      <Rotulo entra={40} tamano={44} peso={600} color={COLOR.tenue} alinear="center" style={{ left: 0, right: 0, top: 710 }}>
        {texto(lang, 'cierre.plataformas')}
      </Rotulo>
    </AbsoluteFill>
  );
};
