import React from 'react';
import { AbsoluteFill, Html5Audio, Sequence, getStaticFiles, staticFile, useCurrentFrame } from 'remotion';
import type { PromoProps } from './copy';
import {
  Escena1Intro,
  Escena2Calendario,
  Escena3Proponer,
  Escena4Fijada,
  Escena5Navegacion,
  Escena6Cierre,
} from './escenas';
import { ESCENAS, TRANSICION, volumenMusica, type NumEscena } from './timing';
import { Fondo, progreso } from './ui/tema';

export const MUSICA = 'audio/musica.mp3';

const ESCENA: Record<NumEscena, React.FC<PromoProps>> = {
  1: Escena1Intro,
  2: Escena2Calendario,
  3: Escena3Proponer,
  4: Escena4Fijada,
  5: Escena5Navegacion,
  6: Escena6Cierre,
};

/** Funde el contenido de cada escena al salir, sobre el mismo fondo: el corte nunca se ve. */
const Salida: React.FC<{ duracion: number; children: React.ReactNode }> = ({ duracion, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: 1 - progreso(frame, duracion - TRANSICION) }}>{children}</AbsoluteFill>;
};

export const QuedamosPromo: React.FC<PromoProps> = ({ lang }) => {
  const conMusica = getStaticFiles().some((f) => f.name === MUSICA);
  return (
    <AbsoluteFill>
      <Fondo />
      {ESCENAS.map((e) => {
        const Escena = ESCENA[e.n];
        return (
          <Sequence key={e.n} from={e.desde} durationInFrames={e.duracion} name={`${e.n} ${e.nombre}`}>
            <Salida duracion={e.duracion}>
              <Escena lang={lang} />
            </Salida>
          </Sequence>
        );
      })}
      {conMusica ? <Html5Audio src={staticFile(MUSICA)} volume={(f) => volumenMusica(f)} name="música" /> : null}
    </AbsoluteFill>
  );
};
