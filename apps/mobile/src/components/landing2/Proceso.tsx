import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Aro, type AroMember } from '../../ui';
import { useMotionSafe } from '../../lib/motion';
import { MEMBER_COLORS } from '../../lib/constants';

const SONDEAR_MEMBERS: AroMember[] = [
  { color: MEMBER_COLORS[0], state: 'on' },
  { color: MEMBER_COLORS[1], state: 'on' },
  { color: MEMBER_COLORS[2], state: 'off' },
  { color: MEMBER_COLORS[3], state: 'on' },
  { color: MEMBER_COLORS[4], state: 'apagado' },
  { color: MEMBER_COLORS[5], state: 'on' },
];
const ALL_ON: AroMember[] = MEMBER_COLORS.map((color) => ({ color, state: 'on' }));

function CheckMark(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--app-text)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <polyline points="4 12 9 17 20 6" />
    </svg>
  );
}

const STEPS = [
  { key: 'sondear', members: SONDEAR_MEMBERS, check: false },
  { key: 'cierra', members: ALL_ON, check: false },
  { key: 'quedamos', members: ALL_ON, check: true },
] as const;

/**
 * «De la pregunta al plan» (zona 6): 3 nodos-aro + línea conectora. Los
 * nodos son del mismo tamaño (r=16) que el icono de NavIsla, así que
 * reutilizan `<Aro>` real en vez de SVG bespoke.
 */
export function Proceso(): JSX.Element {
  const { t } = useTranslation();
  const motionSafe = useMotionSafe();

  return (
    <section className="flex flex-col justify-center gap-14 px-6 lg:px-[110px] py-24">
      <h2 className="font-extrabold text-[46px] tracking-[-0.025em] text-text">
        {t('landing2.proceso.title')}
      </h2>
      <div className="relative">
        <div
          className="hidden lg:block absolute top-[58px] left-[58px] right-[58px] h-px"
          style={{ backgroundColor: 'var(--app-border)' }}
          aria-hidden="true"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-14">
          {STEPS.map(({ key, members, check }, i) => (
            <motion.div
              key={key}
              className="relative flex flex-col gap-[18px]"
              initial={motionSafe ? { opacity: 0, y: 16 } : undefined}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: motionSafe ? i * 0.1 : 0 }}
            >
              <div className="flex items-center justify-center w-[116px] h-[116px] rounded-pill bg-bg border border-subtle">
                <Aro members={members} size={96}>
                  {check ? <CheckMark /> : undefined}
                </Aro>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-text-muted">
                  {t(`landing2.proceso.steps.${key}.index`)}
                </span>
                <span className="font-extrabold text-2xl tracking-[-0.02em] text-text">
                  {t(`landing2.proceso.steps.${key}.title`)}
                </span>
              </div>
              <p className="text-[17px] leading-[1.5] text-text-muted max-w-[340px]">
                {t(`landing2.proceso.steps.${key}.description`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
