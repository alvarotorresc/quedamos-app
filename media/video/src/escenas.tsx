import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { texto, type CopyKey, type PromoProps } from './copy';
import { TRANSICION } from './timing';
import { Logo } from './ui/Logo';
import { COLOR, MIEMBRO, Rotulo, progreso } from './ui/tema';

/** Golpes de la intro, en ataques de la música: el segundo texto entra con un corte y el aro después. */
/** Intro: primero la marca (aro que se dibuja y «Quedamos»), luego los dos golpes de texto. */
export const INTRO = { golpe1: 75, golpe2: 112 } as const;

/**
 * Marca centrada: aro y «Quedamos» como un bloque con el mismo aire arriba y abajo. `ajuste` corrige lo
 * que la caja de línea añade bajo el texto, medido sobre la tinta del still (npm run stills).
 */
const Marca: React.FC<{ logo: number; titulo: number; hueco: number; ajuste: number; dibujo: number; entraTitulo: number; children?: React.ReactNode }> = ({
  logo,
  titulo,
  hueco,
  ajuste,
  dibujo,
  entraTitulo,
  children,
}) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${ajuste}px)` }}>
      <Logo tamano={logo} dibujo={dibujo} />
      <Rotulo entra={entraTitulo} tamano={titulo} peso={800} alinear="center" style={{ position: 'relative', marginTop: hueco, lineHeight: 1 }}>
        Quedamos
      </Rotulo>
      {children}
    </div>
  </AbsoluteFill>
);

const Golpe: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = COLOR.crema }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
    <Rotulo entra={-TRANSICION} tamano={96} peso={800} color={color} alinear="center" style={{ position: 'relative' }}>
      {children}
    </Rotulo>
  </AbsoluteFill>
);

export const Escena1Intro: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  if (frame < INTRO.golpe1) {
    return <Marca logo={260} titulo={128} hueco={40} ajuste={-6} dibujo={progreso(frame, 0, 24)} entraTitulo={8} />;
  }
  if (frame < INTRO.golpe2) {
    return (
      <AbsoluteFill style={{ opacity: progreso(frame, INTRO.golpe1, 6) }}>
        <Golpe>{texto(lang, 'intro.golpe1')}</Golpe>
      </AbsoluteFill>
    );
  }
  return <Golpe>{texto(lang, 'intro.golpe2')}</Golpe>;
};

/** Rótulo de una escena del escenario, en la franja inferior centrada; se va antes de que entre el siguiente. */
export const RotuloEscena: React.FC<{ lang: PromoProps['lang']; clave: CopyKey; duracion: number }> = ({ lang, clave, duracion }) => (
  <Rotulo entra={2} sale={duracion - TRANSICION} tamano={60} alinear="center" style={{ left: 0, right: 0, top: 952 }}>
    {texto(lang, clave)}
  </Rotulo>
);

export const Escena7Cierre: React.FC<PromoProps> = ({ lang }) => {
  const frame = useCurrentFrame();
  return (
    <Marca logo={220} titulo={112} hueco={36} ajuste={-5} dibujo={progreso(frame, 0, 24)} entraTitulo={12}>
      <Rotulo entra={26} tamano={46} mono peso={500} color={MIEMBRO.blue} alinear="center" style={{ position: 'relative', marginTop: 44, lineHeight: 1 }}>
        quedamos.alvarotc.com
      </Rotulo>
      <Rotulo entra={38} tamano={42} peso={600} color={COLOR.tenue} alinear="center" style={{ position: 'relative', marginTop: 22, lineHeight: 1 }}>
        {texto(lang, 'cierre.plataformas')}
      </Rotulo>
    </Marca>
  );
};
