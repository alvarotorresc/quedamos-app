import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Aro, type AroMember } from '../../ui';
import { aroArc } from '../../lib/aro-geometry';
import { useMotionSafe } from '../../lib/motion';
import { MEMBER_COLORS } from '../../lib/constants';
import { CtaArrow } from './NavIsla';

const HALO_RADIUS = 300;
const HALO_STROKE = 36;
const HALO_INDICES = [0, 1, 2, 3, 4, 5] as const;

// «vie 13»: disponibilidad parcial del mockup (2 on, 1 off, 1 apagado corto, 2 on).
const FRIDAY_MEMBERS: AroMember[] = [
  { color: MEMBER_COLORS[0], state: 'on' },
  { color: MEMBER_COLORS[1], state: 'on' },
  { color: MEMBER_COLORS[2], state: 'off' },
  { color: MEMBER_COLORS[3], state: 'on' },
  { color: MEMBER_COLORS[4], state: 'apagado' },
  { color: MEMBER_COLORS[5], state: 'on' },
];
const ALL_ON: AroMember[] = MEMBER_COLORS.map((color) => ({ color, state: 'on' }));

/**
 * Héroe split (zona 2 del lienzo): titular 128px + móvil de la Pregunta rotado
 * 2° + aro gigante r=300 sw=36 de halo. El halo es bespoke (aroArc explícito):
 * Aro.tsx fija R=16 internamente, no cubre un radio de diseño de 300.
 *
 * El lienzo es un lienzo de 1440px fijo: titular (pl-110 + max-w-640) y móvil
 * (right-330, w-340) chocan por debajo de ~1420px si se usan tal cual. Los
 * tamaños se escalan en 3 escalones (lg/xl/2xl) — solo el escalón 2xl (≥1536)
 * usa los valores exactos del artboard, donde ya hay margen de sobra.
 */
export function HeroPregunta(): JSX.Element {
  const { t } = useTranslation();
  const motionSafe = useMotionSafe();

  return (
    <section className="relative flex items-center min-h-[860px] overflow-hidden pt-16 pl-6 lg:pl-16 xl:pl-20 2xl:pl-[110px] pr-6">
      <motion.svg
        width={700}
        height={700}
        viewBox="-350 -350 700 700"
        className="absolute -right-2.5 top-[110px] pointer-events-none"
        aria-hidden="true"
        animate={motionSafe ? { scale: [1, 1.006, 1] } : undefined}
        transition={motionSafe ? { duration: 6, repeat: 4, ease: 'easeInOut' } : undefined}
        data-testid="hero-halo"
        data-motion={motionSafe ? 'breathing' : 'static'}
      >
        <g>
          {HALO_INDICES.map((i) => {
            const { dasharray, rotate } = aroArc(6, i, HALO_RADIUS, { strokeWidth: HALO_STROKE });
            return (
              <circle
                key={i}
                cx={0}
                cy={0}
                r={HALO_RADIUS}
                fill="none"
                stroke={MEMBER_COLORS[i]}
                strokeWidth={HALO_STROKE}
                strokeLinecap="round"
                strokeDasharray={dasharray}
                transform={`rotate(${rotate.toFixed(2)})`}
              />
            );
          })}
        </g>
      </motion.svg>

      <div className="flex flex-col gap-[34px] max-w-[380px] lg:max-w-[420px] xl:max-w-[460px] 2xl:max-w-[640px] z-[2]">
        <h1 className="font-extrabold text-[52px] lg:text-[64px] xl:text-[76px] 2xl:text-[128px] leading-[0.98] 2xl:leading-[0.96] tracking-[-0.045em] text-text">
          {t('landing2.hero.title')}
        </h1>
        <p className="text-base lg:text-lg 2xl:text-[23px] leading-[1.45] text-text-muted max-w-[340px] 2xl:max-w-[460px]">
          {t('landing2.hero.subtitle')}
        </p>
        <Link
          to="/login"
          className="flex items-center gap-2.5 h-14 pl-[26px] pr-2 rounded-pill bg-primary text-on-primary font-bold text-base self-start"
        >
          <span>{t('landing2.cta')}</span>
          <CtaArrow size={40} />
        </Link>
      </div>

      {/*
        El anillo gigante no es responsive (mismo -right-2.5/700px en todos los
        breakpoints), así que a partir de xl (1280px) el móvil usa la posición
        EXACTA del artboard (right-330/w-340) para quedar sobre la mitad
        IZQUIERDA del aro, dejando su semicírculo derecho limpio (verificado:
        a 1280px el móvil sigue sin chocar con el titular, margen ~70px). El
        valor intermedio (lg, 1024-1279) no se toca: ya no solapa el titular.
      */}
      <div
        className="hidden lg:block absolute right-6 xl:right-[330px] top-[165px] z-[2]"
        style={{ transform: 'rotate(2deg)' }}
      >
        <div className="w-[240px] xl:w-[340px] p-2.5 rounded-[48px] bg-bg-surface border border-subtle">
          <div className="flex flex-col gap-4 h-[600px] px-[18px] py-[22px] rounded-[39px] bg-bg border border-subtle overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xl tracking-tight text-text">
                {t('landing2.hero.mockup.today')}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                {t('landing2.hero.mockup.month')}
              </span>
            </div>
            <div className="flex flex-col gap-3.5 p-5 rounded-lg bg-bg-light border border-subtle">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-pill shrink-0"
                  style={{ backgroundColor: MEMBER_COLORS[4] }}
                  aria-hidden="true"
                />
                <span className="text-[13px] text-text-muted">
                  {t('landing2.hero.mockup.asks')}
                </span>
              </div>
              <p className="font-extrabold text-[27px] leading-[1.1] tracking-tight text-text">
                {t('landing2.hero.mockup.question')}
              </p>
              {/*
                Sin flex-1: dos pills de ancho igual hacen que el texto EN más
                largo ("Can't make it") se envuelva dentro de su pill. Cada
                pill se ajusta a su contenido (px + whitespace-nowrap) en vez
                de repartirse el ancho a partes iguales.
              */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <span className="flex items-center justify-center h-11 px-5 whitespace-nowrap rounded-pill bg-primary text-on-primary font-bold text-[15px]">
                  {t('landing2.hero.mockup.canGo')}
                </span>
                <span className="flex items-center justify-center h-11 px-5 whitespace-nowrap rounded-pill border border-strong text-text font-bold text-[15px]">
                  {t('landing2.hero.mockup.cannotGo')}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 rounded-lg border border-subtle">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  {t('landing2.hero.mockup.fri')}
                </span>
                <span className="font-extrabold text-xl text-text">13</span>
              </div>
              <Aro members={FRIDAY_MEMBERS} size={26} />
            </div>
            <div className="flex flex-col gap-2.5 p-4 rounded-[18px] bg-primary text-on-primary">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70">
                    {t('landing2.hero.mockup.sat')}
                  </span>
                  <span className="font-extrabold text-xl">14</span>
                </div>
                <Aro members={ALL_ON} size={30} />
              </div>
              <p className="font-bold text-[15px]">{t('landing2.hero.mockup.allCan')}</p>
              <span className="flex items-center justify-center h-[38px] rounded-pill bg-bg text-text font-bold text-[13px]">
                {t('landing2.hero.mockup.askCta')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
