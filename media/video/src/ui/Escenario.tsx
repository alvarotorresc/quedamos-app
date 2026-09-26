import React from 'react';
import { AbsoluteFill, Img, getStaticFiles, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { texto, type Lang } from '../copy';
import {
  ASPECTO,
  AVISO,
  DURACION_PULSO,
  ETIQUETA_LEO,
  FRAME_TAP,
  NIVELES,
  PASOS,
  QUIEN_TOCA,
  TAPS,
  nivelEn,
  pasoEn,
  type Caja,
  type Cajas,
  type Estado,
  type Movil,
} from '../guion';
import { Marco, medidasPhone } from './Dispositivos';
import { Logo } from './Logo';
import { COLOR, FUENTE, MIEMBRO, SALIDA, progreso } from './tema';
import { TRANSICION, escena } from '../timing';

/** Ruta en public/ que deja `npm run preparar` desde media/out/rodaje. */
export const rutaRodaje = (lang: Lang, estado: Estado) => `rodaje/${lang}/${estado}.png`;

// Colores por orden de entrada al grupo de demo (media/seed: Marta, Hugo, Noa, Leo, Julia).
export const COLOR_MOVIL: Record<Movil, string> = { marta: MIEMBRO.blue, hugo: MIEMBRO.orange };
const COLOR_LEO = MIEMBRO.green;

const suave = (t: number) => interpolate(t, [0, 1], [0, 1], { easing: SALIDA });

const Captura: React.FC<{ lang: Lang; estado: Estado; style?: React.CSSProperties }> = ({ lang, estado, style }) => {
  const ruta = rutaRodaje(lang, estado);
  const base: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style };
  return getStaticFiles().some((f) => f.name === ruta) ? (
    <Img src={staticFile(ruta)} style={base} />
  ) : (
    <div style={{ ...base, backgroundColor: COLOR.marco, color: COLOR.tenue, fontFamily: FUENTE, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {estado}
    </div>
  );
};

const Velo: React.FC<{ opacidad: number }> = ({ opacidad }) => (
  <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: opacidad }} />
);

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
const LETRAS_TITULO = [...'Cena del viernes'].length;

/** Capas de la pantalla en este frame: la captura vigente y, mientras dura su efecto, la anterior. */
const Pantalla: React.FC<{ lang: Lang; movil: Movil; cajas: Cajas }> = ({ lang, movil, cajas }) => {
  const frame = useCurrentFrame();
  const { actual, previo, t } = pasoEn(PASOS[movil], frame);
  if (previo === null || t >= 1) return <Captura lang={lang} estado={actual.estado} />;
  const p = suave(t);
  const antes = <Captura lang={lang} estado={previo.estado} />;
  switch (actual.efecto) {
    case 'sube':
      // La hoja sube desde el borde inferior sobre la pantalla anterior, que se oscurece.
      return (
        <>
          {antes}
          <Velo opacidad={0.4 * p} />
          <Captura lang={lang} estado={actual.estado} style={{ transform: `translateY(${pct(1 - p)})` }} />
        </>
      );
    case 'baja':
      // La hoja baja y deja ver la pantalla nueva debajo.
      return (
        <>
          <Captura lang={lang} estado={actual.estado} />
          <Velo opacidad={0.4 * (1 - p)} />
          <Captura lang={lang} estado={previo.estado} style={{ transform: `translateY(${pct(p)})` }} />
        </>
      );
    case 'entra':
      // La tarjeta del mazo entra desde abajo con un desplazamiento corto.
      return (
        <>
          {antes}
          <Captura lang={lang} estado={actual.estado} style={{ opacity: p, transform: `translateY(${pct((1 - p) * 0.14)})` }} />
        </>
      );
    case 'escribe': {
      // Tecleo: la hoja rellena asoma letra a letra dentro de la caja del título; al final se
      // funde entera por si cambia algo más (el botón se activa).
      const c = cajas.titulo;
      const letras = Math.min(LETRAS_TITULO, Math.floor((t / 0.8) * LETRAS_TITULO));
      const r = letras / LETRAS_TITULO;
      const final = Math.max(0, (t - 0.8) / 0.2);
      return (
        <>
          {antes}
          <Captura
            lang={lang}
            estado={actual.estado}
            style={{ clipPath: `inset(${pct(c.y)} ${pct(1 - c.x - c.w * r)} ${pct(1 - c.y - c.h)} ${pct(c.x)})` }}
          />
          <Captura lang={lang} estado={actual.estado} style={{ opacity: final }} />
        </>
      );
    }
    default:
      return (
        <>
          {antes}
          <Captura lang={lang} estado={actual.estado} style={{ opacity: p }} />
        </>
      );
  }
};

/** Pulso de toque: círculo del color de quien toca que se abre y se apaga sobre el elemento. */
const Pulso: React.FC<{ caja: Caja; color: string; desde: number; alto: number }> = ({ caja, color, desde, alto }) => {
  const frame = useCurrentFrame();
  const t = (frame - desde) / DURACION_PULSO;
  if (t < 0 || t > 1) return null;
  const e = suave(t);
  const m = medidasPhone(alto);
  const base = Math.max(caja.h * m.alto, 40);
  const d = base * (0.7 + 1.5 * e);
  return (
    <div
      style={{
        position: 'absolute',
        left: pct(caja.x + caja.w / 2),
        top: pct(caja.y + caja.h / 2),
        width: d,
        height: d,
        marginLeft: -d / 2,
        marginTop: -d / 2,
        borderRadius: '50%',
        border: `4px solid ${color}`,
        backgroundColor: `${color}40`,
        boxSizing: 'border-box',
        opacity: 1 - e,
      }}
    />
  );
};

/** Aviso «Nueva quedada» que cae por arriba en la pantalla de Hugo. */
const Aviso: React.FC<{ lang: Lang; alto: number }> = ({ lang, alto }) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, AVISO.cae) * (1 - progreso(frame, AVISO.sube));
  if (p <= 0) return null;
  const u = medidasPhone(alto).ancho / 360; // píxeles CSS del móvil (360 de ancho) a píxeles del vídeo
  return (
    <div
      style={{
        position: 'absolute',
        left: 10 * u,
        right: 10 * u,
        top: 12 * u,
        transform: `translateY(${(p - 1) * 120}%)`,
        opacity: p,
        display: 'flex',
        alignItems: 'center',
        gap: 12 * u,
        padding: `${12 * u}px ${14 * u}px`,
        borderRadius: 18 * u,
        backgroundColor: 'rgba(38, 34, 27, 0.97)',
        border: `1px solid ${COLOR.borde}`,
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
        fontFamily: FUENTE,
        color: COLOR.crema,
      }}
    >
      <Logo tamano={40 * u} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 * u }}>
        <span style={{ fontSize: 14 * u, color: COLOR.tenue, fontWeight: 600 }}>Quedamos</span>
        <span style={{ fontSize: 21 * u, fontWeight: 700 }}>{texto(lang, 'responder.aviso')}</span>
      </div>
    </div>
  );
};

export const ALTO_PHONE = 740;
const TOP_PHONE = 128;
const SEPARACION = 290; // del centro del lienzo al centro de cada móvil
const X_CENTRO: Record<Movil, number> = { marta: 960 - SEPARACION, hugo: 960 + SEPARACION };
const NOMBRE: Record<Movil, string> = { marta: 'Marta', hugo: 'Hugo' };

const aspecto = (movil: Movil, frame: number) => {
  const { actual, previo, t } = nivelEn(NIVELES[movil], frame);
  const p = suave(t);
  const a = ASPECTO[previo];
  const b = ASPECTO[actual];
  return { escala: a.escala + (b.escala - a.escala) * p, brillo: a.brillo + (b.brillo - a.brillo) * p };
};

const Etiqueta: React.FC<{ lang: Lang; movil: Movil; brillo: number }> = ({ lang, movil, brillo }) => (
  <div
    style={{
      position: 'absolute',
      left: X_CENTRO[movil] - 300,
      width: 600,
      top: 44,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 14,
      fontFamily: FUENTE,
      fontSize: 36,
      lineHeight: 1,
      letterSpacing: '-0.01em',
      opacity: brillo,
    }}
  >
    <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: COLOR_MOVIL[movil] }} />
    <span style={{ fontWeight: 700, color: COLOR.crema }}>{NOMBRE[movil]}</span>
    <span style={{ fontWeight: 500, color: COLOR.tenue }}>{texto(lang, movil === 'marta' ? 'escenario.marta' : 'escenario.hugo')}</span>
  </div>
);

const EtiquetaLeo: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const p = progreso(frame, ETIQUETA_LEO.entra) * (1 - progreso(frame, ETIQUETA_LEO.sale));
  if (p <= 0) return null;
  const derechaHugo = X_CENTRO.hugo + medidasPhone(ALTO_PHONE).anchoTotal * 0.52;
  return (
    <div
      style={{
        position: 'absolute',
        left: derechaHugo + 36,
        top: TOP_PHONE + 250,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 24px',
        borderRadius: 999,
        backgroundColor: COLOR.marco,
        border: `1px solid ${COLOR.borde}`,
        fontFamily: FUENTE,
        fontSize: 34,
        fontWeight: 700,
        lineHeight: 1,
        color: COLOR.crema,
        opacity: p,
        transform: `translateX(${(1 - p) * -16}px)`,
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: '50%', border: `3px solid ${COLOR_LEO}`, opacity: 0.6 }} />
      {texto(lang, 'respuestas.leo')}
    </div>
  );
};

/**
 * Los dos móviles de las escenas 2 a 6: Marta a la izquierda y Hugo a la derecha, cada uno con su
 * nombre encima. Va fuera de cualquier Sequence: lee el frame global del vídeo, entra al empezar la
 * escena 2 y se funde al acabar la 6.
 */
export const Escenario: React.FC<{ lang: Lang; cajas: Cajas }> = ({ lang, cajas }) => {
  const frame = useCurrentFrame();
  const inicio = escena(2).desde;
  const fin = escena(6).desde + escena(6).duracion;
  if (frame < inicio || frame >= fin) return null;
  const entrada = progreso(frame, inicio);
  const salida = 1 - progreso(frame, fin - TRANSICION);
  const m = medidasPhone(ALTO_PHONE);
  return (
    <AbsoluteFill style={{ opacity: entrada * salida }}>
      {(['marta', 'hugo'] as const).map((movil) => {
        const a = aspecto(movil, frame);
        return (
          <React.Fragment key={movil}>
            <Etiqueta lang={lang} movil={movil} brillo={a.brillo} />
            <Marco
              alto={ALTO_PHONE}
              style={{
                left: X_CENTRO[movil] - m.anchoTotal / 2,
                top: TOP_PHONE + (1 - entrada) * 40,
                transform: `scale(${a.escala})`,
                filter: `brightness(${a.brillo})`,
              }}
            >
              <Pantalla lang={lang} movil={movil} cajas={cajas} />
              {TAPS.filter((tap) => QUIEN_TOCA[tap] === movil).map((tap) => (
                <Pulso key={tap} caja={cajas[tap]} color={COLOR_MOVIL[movil]} desde={FRAME_TAP[tap]} alto={ALTO_PHONE} />
              ))}
              {movil === 'hugo' ? <Aviso lang={lang} alto={ALTO_PHONE} /> : null}
            </Marco>
          </React.Fragment>
        );
      })}
      <EtiquetaLeo lang={lang} />
    </AbsoluteFill>
  );
};
