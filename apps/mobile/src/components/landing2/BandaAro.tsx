import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { aroArc } from '../../lib/aro-geometry';
import { spring, useMotionSafe } from '../../lib/motion';
import { MEMBER_COLORS } from '../../lib/constants';

const CENTER_RADIUS = 120;
const CENTER_STROKE = 16;
const SIDE_RADIUS = 88;
const SIDE_STROKE = 13;
const INDICES = [0, 1, 2, 3, 4, 5] as const;

/**
 * Icono «en el aire»: uno sin responder (hueco) y uno que no puede (arco
 * corto, mismo convenio `apagado` que Aro/tarjeta.ts: strokeWidth explícito +
 * short a mitad de dash).
 */
function PendingIcon(): JSX.Element {
  return (
    <svg width={92} height={92} viewBox="-110 -110 220 220" aria-hidden="true">
      <g>
        <circle
          cx={0}
          cy={0}
          r={SIDE_RADIUS}
          fill="none"
          stroke="var(--app-border)"
          strokeWidth={SIDE_STROKE}
        />
        {INDICES.map((i) => {
          if (i === 2) return null; // hueco: falta por responder
          const short = i === 4;
          const { dasharray, rotate } = aroArc(6, i, SIDE_RADIUS, {
            strokeWidth: SIDE_STROKE,
            short,
          });
          return (
            <circle
              key={i}
              cx={0}
              cy={0}
              r={SIDE_RADIUS}
              fill="none"
              stroke={short ? 'var(--app-apagado)' : MEMBER_COLORS[i]}
              strokeWidth={SIDE_STROKE}
              strokeLinecap="round"
              strokeDasharray={dasharray}
              transform={`rotate(${rotate.toFixed(2)})`}
            />
          );
        })}
      </g>
    </svg>
  );
}

function SealedIcon(): JSX.Element {
  return (
    <svg width={92} height={92} viewBox="-110 -110 220 220" aria-hidden="true">
      <g>
        {INDICES.map((i) => {
          const { dasharray, rotate } = aroArc(6, i, SIDE_RADIUS, { strokeWidth: SIDE_STROKE });
          return (
            <circle
              key={i}
              cx={0}
              cy={0}
              r={SIDE_RADIUS}
              fill="none"
              stroke={MEMBER_COLORS[i]}
              strokeWidth={SIDE_STROKE}
              strokeLinecap="round"
              strokeDasharray={dasharray}
              transform={`rotate(${rotate.toFixed(2)})`}
            />
          );
        })}
        <path
          d="M -30 3 L -9 24 L 34 -22"
          fill="none"
          stroke="var(--app-on-primary)"
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * Banda invertida (zona 3): aro central r=120 sw=16 + dos estados r=88 sw=13.
 * Bespoke via `aroArc` con strokeWidth explícito (mismo patrón que Logo.tsx y
 * tarjeta.ts): Aro.tsx fija su propio strokeWidth automático a partir de un
 * radio interno de 16, así que no reproduce estas proporciones de diseño.
 * El aro central «se cierra» al entrar en viewport; con reduced-motion se
 * pinta ya cerrado (gate observable vía `data-motion`, ver test).
 */
export function BandaAro(): JSX.Element {
  const { t } = useTranslation();
  const motionSafe = useMotionSafe();

  const arcs = INDICES.map((i) => {
    const { dasharray, rotate } = aroArc(6, i, CENTER_RADIUS, { strokeWidth: CENTER_STROKE });
    return { i, dasharray, rotate, color: MEMBER_COLORS[i] };
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-[72px] items-center px-6 lg:px-[110px] py-24 bg-primary text-on-primary">
      <div className="flex items-center justify-center gap-[60px] flex-wrap">
        <div className="relative w-[300px] h-[300px]" data-testid="banda-aro-center">
          <svg
            width={300}
            height={300}
            viewBox="-140 -140 280 280"
            className="absolute inset-0"
            aria-hidden="true"
            data-motion={motionSafe ? 'closing' : 'static'}
          >
            <g>
              <circle
                cx={0}
                cy={0}
                r={CENTER_RADIUS}
                fill="none"
                stroke="var(--app-border)"
                strokeWidth={CENTER_STROKE}
              />
              {arcs.map(({ i, dasharray, rotate, color }) =>
                motionSafe ? (
                  <motion.circle
                    key={i}
                    cx={0}
                    cy={0}
                    r={CENTER_RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth={CENTER_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={dasharray}
                    transform={`rotate(${rotate.toFixed(2)})`}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ ...spring.bouncy, delay: i * 0.08 }}
                  />
                ) : (
                  <circle
                    key={i}
                    cx={0}
                    cy={0}
                    r={CENTER_RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth={CENTER_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={dasharray}
                    transform={`rotate(${rotate.toFixed(2)})`}
                  />
                ),
              )}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="font-mono text-xs uppercase tracking-[0.14em] opacity-60">
              {t('landing2.banda.weekday')}
            </span>
            <span className="font-extrabold text-[100px] leading-none tracking-[-0.04em]">
              {t('landing2.banda.dayNumber')}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-9">
          <div className="flex items-center gap-4">
            <PendingIcon />
            <p className="text-[15px] leading-[1.45] opacity-70 max-w-[190px]">
              {t('landing2.banda.pending')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <SealedIcon />
            <p className="text-[15px] leading-[1.45] opacity-70 max-w-[190px]">
              {t('landing2.banda.sealed')}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-[18px] pr-6">
        <h2 className="font-extrabold text-[52px] leading-[1.05] tracking-[-0.03em]">
          {t('landing2.banda.title')}
        </h2>
        <p className="text-lg leading-[1.5] opacity-70">{t('landing2.banda.subtitle')}</p>
      </div>
    </section>
  );
}
