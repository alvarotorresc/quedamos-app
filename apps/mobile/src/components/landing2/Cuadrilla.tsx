import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMotionSafe } from '../../lib/motion';
import { MEMBER_COLORS } from '../../lib/constants';

const NAME_KEYS = ['vera', 'hugo', 'noa', 'leo', 'iris', 'teo'] as const;
// Tinta fija del lienzo sobre los 6 colores de miembro: el artboard usa este
// mismo #14120E en día Y noche (no es `on-primary`, que invierte por tema).
const MEMBER_INK = '#14120E';

/**
 * «Seis colores. El tuyo es el tuyo.» (zona 5): franjas de los 6 colores de
 * miembro con nombres ficticios. Colores en `MEMBER_COLORS` (mismo orden que
 * el aro del lienzo: blue/orange/pink/green/purple/red = Vera/Hugo/Noa/Leo/Iris/Teo).
 */
export function Cuadrilla(): JSX.Element {
  const { t } = useTranslation();
  const motionSafe = useMotionSafe();
  return (
    <motion.section
      data-testid="cuadrilla-section"
      className="flex flex-col"
      initial={motionSafe ? { opacity: 0, y: 16 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="px-6 lg:px-[110px] pt-24 pb-[54px]">
        <h2 className="font-extrabold text-[56px] tracking-[-0.03em] text-text">
          {t('landing2.cuadrilla.title')}
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-[340px]">
        {NAME_KEYS.map((key, i) => (
          <div
            key={key}
            className="flex items-end p-6"
            style={{ backgroundColor: MEMBER_COLORS[i] }}
          >
            <span
              className="font-extrabold text-2xl tracking-[-0.02em]"
              style={{ color: MEMBER_INK }}
            >
              {t(`landing2.cuadrilla.names.${key}`)}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
