import React from 'react';
import { AbsoluteFill, Html5Audio, Sequence, getStaticFiles, staticFile, useCurrentFrame } from 'remotion';
import type { CopyKey, PromoProps } from './copy';
import { Escena1Intro, Escena7Cierre, RotuloEscena } from './escenas';
import { CAJAS_RESERVA, TAPS, type TapsRodaje } from './guion';
import { TRANSICION, escena, volumenMusica } from './timing';
import { Escenario } from './ui/Escenario';
import { Fondo, progreso } from './ui/tema';

export const MUSICA = 'audio/musica.mp3';
export const TAPS_JSON = 'rodaje/taps.json';

export type VideoProps = PromoProps & { taps?: TapsRodaje };

/** Lee public/rodaje/taps.json (lo deja `npm run preparar`) antes de renderizar; sin él, cajas de reserva. */
export const cargarTaps = async (): Promise<TapsRodaje | undefined> => {
  if (!getStaticFiles().some((f) => f.name === TAPS_JSON)) return undefined;
  const r = await fetch(staticFile(TAPS_JSON));
  if (!r.ok) throw new Error(`No se pudo leer ${TAPS_JSON}: ${r.status}`);
  const datos = (await r.json()) as Record<string, unknown>;
  const esCajas = (v: unknown): boolean =>
    typeof v === 'object' && v !== null && TAPS.every((t) => typeof (v as Record<string, unknown>)[t] === 'object');
  if (!esCajas(datos.es) || !esCajas(datos.en)) throw new Error(`${TAPS_JSON} no trae las cinco cajas por idioma`);
  return datos as TapsRodaje;
};

const ROTULOS: { n: 2 | 3 | 4 | 5 | 6; clave: CopyKey }[] = [
  { n: 2, clave: 'calendario.rotulo' },
  { n: 3, clave: 'proponer.rotulo' },
  { n: 4, clave: 'responder.rotulo' },
  { n: 5, clave: 'respuestas.rotulo' },
  { n: 6, clave: 'fijada.rotulo' },
];

/** Funde el contenido al salir, sobre el mismo fondo: el corte nunca se ve. */
const Salida: React.FC<{ duracion: number; children: React.ReactNode }> = ({ duracion, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: 1 - progreso(frame, duracion - TRANSICION) }}>{children}</AbsoluteFill>;
};

/**
 * Intro y cierre van en su Sequence; los dos móviles de las escenas 2 a 6 son una sola capa que no se
 * corta entre escenas, y encima de ella cada escena pone su rótulo.
 */
export const QuedamosPromo: React.FC<VideoProps> = ({ lang, taps }) => {
  const conMusica = getStaticFiles().some((f) => f.name === MUSICA);
  const intro = escena(1);
  const cierre = escena(7);
  return (
    <AbsoluteFill>
      <Fondo />
      <Sequence from={intro.desde} durationInFrames={intro.duracion} name="1 intro">
        <Salida duracion={intro.duracion}>
          <Escena1Intro lang={lang} />
        </Salida>
      </Sequence>
      <Escenario lang={lang} cajas={taps?.[lang] ?? CAJAS_RESERVA} />
      {ROTULOS.map(({ n, clave }) => (
        <Sequence key={n} from={escena(n).desde} durationInFrames={escena(n).duracion} name={`${n} ${escena(n).nombre}`}>
          <RotuloEscena lang={lang} clave={clave} duracion={escena(n).duracion} />
        </Sequence>
      ))}
      <Sequence from={cierre.desde} durationInFrames={cierre.duracion} name="7 cierre">
        <Salida duracion={cierre.duracion}>
          <Escena7Cierre lang={lang} />
        </Salida>
      </Sequence>
      {conMusica ? <Html5Audio src={staticFile(MUSICA)} volume={(f) => volumenMusica(f)} name="música" /> : null}
    </AbsoluteFill>
  );
};
