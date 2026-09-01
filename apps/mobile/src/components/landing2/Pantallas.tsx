import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Aro, type AroMember } from '../../ui';
import { SegmentedPills } from '../../ui/SegmentedPills';
import { aroArc, slotCenter } from '../../lib/aro-geometry';
import { useMotionSafe } from '../../lib/motion';
import { MEMBER_COLORS } from '../../lib/constants';

const RING_RADIUS = 88;
const RING_STROKE = 13;
const INITIAL_SIZE = 28;
const INDICES = [0, 1, 2, 3, 4, 5] as const;
const INITIALS = ['V', 'H', 'N', 'L', 'I', 'T'] as const;
// Tinta fija del lienzo sobre los 6 colores de miembro: el artboard usa este
// mismo #14120E en día Y noche (no es `on-primary`, que invierte por tema).
const MEMBER_INK = '#14120E';

const THU_MEMBERS: AroMember[] = [
  { color: MEMBER_COLORS[0], state: 'on' },
  { color: MEMBER_COLORS[1], state: 'off' },
  { color: MEMBER_COLORS[2], state: 'on' },
  { color: MEMBER_COLORS[3], state: 'off' },
  { color: MEMBER_COLORS[4], state: 'on' },
  { color: MEMBER_COLORS[5], state: 'on' },
];
const FRI_MEMBERS: AroMember[] = [
  { color: MEMBER_COLORS[0], state: 'on' },
  { color: MEMBER_COLORS[1], state: 'on' },
  { color: MEMBER_COLORS[2], state: 'off' },
  { color: MEMBER_COLORS[3], state: 'on' },
  { color: MEMBER_COLORS[4], state: 'apagado' },
  { color: MEMBER_COLORS[5], state: 'on' },
];
const SUN_MEMBERS: AroMember[] = [
  { color: MEMBER_COLORS[0], state: 'off' },
  { color: MEMBER_COLORS[1], state: 'on' },
  { color: MEMBER_COLORS[2], state: 'off' },
  { color: MEMBER_COLORS[3], state: 'on' },
  { color: MEMBER_COLORS[4], state: 'off' },
  { color: MEMBER_COLORS[5], state: 'on' },
];
const CONFIRMED_MEMBERS: AroMember[] = MEMBER_COLORS.map((color) => ({ color, state: 'on' }));
const PENDING_EVENT_MEMBERS: AroMember[] = [
  { color: MEMBER_COLORS[0], state: 'on' },
  { color: MEMBER_COLORS[1], state: 'off' },
  { color: MEMBER_COLORS[2], state: 'on' },
  { color: MEMBER_COLORS[3], state: 'on' },
  { color: MEMBER_COLORS[4], state: 'off' },
  { color: MEMBER_COLORS[5], state: 'on' },
];

function CheckMark(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-success" aria-hidden="true">
      <polyline points="4 12 9 17 20 6" />
    </svg>
  );
}

interface DayRowProps {
  weekday: string;
  day: number;
  members: AroMember[];
}

function DayRow({ weekday, day, members }: DayRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between px-3.5 py-3 rounded-md border border-subtle">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] uppercase text-text-muted">{weekday}</span>
        <span className="font-extrabold text-lg text-text">{day}</span>
      </div>
      <Aro members={members} size={24} />
    </div>
  );
}

/**
 * «Tres pantallas. Ninguna de más.» (zona 4): 3 móviles en cascada -3/0/3 con
 * double-bezel tonal sin sombras. Las filas pequeñas de aro (día/quedada)
 * reutilizan `<Aro>` (misma proporción r=16 del artboard); el ring de
 * Cuadrilla (r=88 sw=13) es bespoke via `aroArc`+`slotCenter`, mismo patrón
 * que `GroupRing.tsx` en producción; Aro.tsx no cubre ese strokeWidth.
 */
export function Pantallas(): JSX.Element {
  const { t } = useTranslation();
  const motionSafe = useMotionSafe();
  const [eventsTab, setEventsTab] = useState<'upcoming' | 'past'>('upcoming');

  const ring = INDICES.map((i) => {
    const { dasharray, rotate } = aroArc(6, i, RING_RADIUS, { strokeWidth: RING_STROKE });
    return { i, dasharray, rotate, color: MEMBER_COLORS[i] };
  });

  return (
    <motion.section
      data-testid="pantallas-section"
      className="flex flex-col gap-[60px] px-6 lg:px-[110px] py-24 bg-bg-light border-y border-subtle"
      initial={motionSafe ? { opacity: 0, y: 16 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col gap-3.5">
        <h2 className="font-extrabold text-[56px] leading-tight tracking-[-0.03em] text-text">
          {t('landing2.pantallas.title')}
        </h2>
        {/* max-w-[600px] (subido de 560): a 560 el EN deja "app." huérfano en su propia línea. */}
        <p className="text-lg text-text-muted max-w-[600px]">{t('landing2.pantallas.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-0">
        {/* Semana */}
        <div className="-mr-6 z-[1]" style={{ transform: 'rotate(-3deg)' }}>
          <div className="w-[300px] p-2.5 rounded-[46px] bg-bg-surface border border-subtle">
            <div className="flex flex-col gap-3.5 p-4 rounded-[37px] bg-bg border border-subtle overflow-hidden">
              <span className="font-extrabold text-xl tracking-tight text-text">
                {t('landing2.pantallas.week.title')}
              </span>
              <DayRow weekday={t('landing2.pantallas.week.thu')} day={12} members={THU_MEMBERS} />
              <DayRow weekday={t('landing2.pantallas.week.fri')} day={13} members={FRI_MEMBERS} />
              <div className="flex flex-col gap-2.5 p-4 rounded-lg bg-primary text-on-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[10px] uppercase opacity-70">
                      {t('landing2.pantallas.week.sat')}
                    </span>
                    <span className="font-extrabold text-lg">14</span>
                  </div>
                  <Aro members={CONFIRMED_MEMBERS} size={28} />
                </div>
                <p className="font-bold text-sm">{t('landing2.pantallas.week.allCan')}</p>
                <span className="flex items-center justify-center h-9 rounded-pill bg-bg text-text font-bold text-[13px]">
                  {t('landing2.pantallas.week.askCta')}
                </span>
              </div>
              <DayRow weekday={t('landing2.pantallas.week.sun')} day={15} members={SUN_MEMBERS} />
            </div>
          </div>
        </div>

        {/* Quedadas */}
        <div className="z-[2]">
          <div className="w-[300px] p-2.5 rounded-[46px] bg-bg-surface border border-subtle">
            <div className="flex flex-col gap-3.5 p-4 rounded-[37px] bg-bg border border-subtle overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xl tracking-tight text-text">
                  {t('landing2.pantallas.events.title')}
                </span>
                <SegmentedPills
                  options={[
                    { value: 'upcoming', label: t('landing2.pantallas.events.upcoming') },
                    { value: 'past', label: t('landing2.pantallas.events.past') },
                  ]}
                  value={eventsTab}
                  onChange={setEventsTab}
                />
              </div>
              <div className="flex flex-col gap-2.5 p-3.5 rounded-lg bg-bg-light border border-subtle">
                <div className="flex items-center gap-2.5">
                  <Aro members={CONFIRMED_MEMBERS} size={40}>
                    <CheckMark />
                  </Aro>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-extrabold text-[15px] tracking-tight text-text">
                      {t('landing2.pantallas.events.dinnerTitle')}
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">
                      {t('landing2.pantallas.events.dinnerTime')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-pill px-2.5 py-0.5 text-[11px] font-bold"
                    style={{ backgroundColor: 'var(--app-success-tint)', color: 'var(--app-success)' }}
                  >
                    {t('landing2.pantallas.events.confirmed')}
                  </span>
                  <div className="flex">
                    {MEMBER_COLORS.map((color, i) => (
                      <span
                        key={color}
                        className="w-[19px] h-[19px] rounded-pill border-2"
                        style={{ backgroundColor: color, borderColor: 'var(--app-bg-light)', marginLeft: i === 0 ? 0 : -6 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-3.5 rounded-lg border border-subtle">
                <div className="flex items-center gap-2.5">
                  <Aro members={PENDING_EVENT_MEMBERS} size={40} />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-extrabold text-[15px] tracking-tight text-text">
                      {t('landing2.pantallas.events.padelTitle')}
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">
                      {t('landing2.pantallas.events.padelTime')}
                    </span>
                  </div>
                </div>
                <span
                  className="self-start rounded-pill px-2.5 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: 'var(--app-warning-tint)', color: 'var(--app-warning)' }}
                >
                  {t('landing2.pantallas.events.pending')}
                </span>
              </div>
              <span className="flex items-center justify-center h-11 rounded-pill border border-strong text-text font-bold text-sm">
                {t('landing2.pantallas.events.propose')}
              </span>
            </div>
          </div>
        </div>

        {/* Cuadrilla */}
        <div className="-ml-6 z-[1]" style={{ transform: 'rotate(3deg)' }}>
          <div className="w-[300px] p-2.5 rounded-[46px] bg-bg-surface border border-subtle">
            <div className="flex flex-col gap-4 p-4 rounded-[37px] bg-bg border border-subtle overflow-hidden">
              <span className="font-extrabold text-xl tracking-tight text-text">
                {t('landing2.pantallas.group.title')}
              </span>
              <div className="flex justify-center py-2">
                <div className="relative" style={{ width: 190, height: 190 }}>
                  <svg width={190} height={190} viewBox="-95 -95 190 190" className="absolute inset-0" aria-hidden="true">
                    <circle cx={0} cy={0} r={RING_RADIUS} fill="none" stroke="var(--app-border)" strokeWidth={RING_STROKE} />
                    {ring.map(({ i, dasharray, rotate, color }) => (
                      <circle
                        key={i}
                        cx={0}
                        cy={0}
                        r={RING_RADIUS}
                        fill="none"
                        stroke={color}
                        strokeWidth={RING_STROKE}
                        strokeLinecap="round"
                        strokeDasharray={dasharray}
                        transform={`rotate(${rotate.toFixed(2)})`}
                      />
                    ))}
                  </svg>
                  {INDICES.map((i) => {
                    const p = slotCenter(6, i, RING_RADIUS);
                    return (
                      <span
                        key={i}
                        className="absolute flex items-center justify-center rounded-pill font-extrabold text-xs"
                        style={{
                          left: 95 + p.x - INITIAL_SIZE / 2,
                          top: 95 + p.y - INITIAL_SIZE / 2,
                          width: INITIAL_SIZE,
                          height: INITIAL_SIZE,
                          backgroundColor: MEMBER_COLORS[i],
                          color: MEMBER_INK,
                        }}
                      >
                        {INITIALS[i]}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-md border border-subtle">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-pill" style={{ backgroundColor: MEMBER_COLORS[0] }} />
                  <span className="font-bold text-sm text-text">{t('landing2.cuadrilla.names.vera')}</span>
                </div>
                <span className="font-mono text-[11px] text-text-muted">
                  {t('landing2.pantallas.group.of6', { count: 6 })}
                </span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-md border border-subtle">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-pill" style={{ backgroundColor: MEMBER_COLORS[4] }} />
                  <span className="font-bold text-sm text-text">{t('landing2.cuadrilla.names.iris')}</span>
                </div>
                <span className="font-mono text-[11px] text-text-muted">
                  {t('landing2.pantallas.group.of6', { count: 5 })}
                </span>
              </div>
              <span className="flex items-center justify-center h-11 rounded-pill border border-strong text-text font-bold text-sm">
                {t('landing2.pantallas.group.invite')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
