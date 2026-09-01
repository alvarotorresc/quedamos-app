import { Fragment, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMotionSafe } from '../../lib/motion';

const ITEM_KEYS = ['interrogate', 'confetti', 'streaks', 'punish', 'shoutEmoji', 'aiPlan'] as const;

/**
 * «Lo que Quedamos no va a hacer nunca» (zona 7): lista tachada. El tachado
 * usa el token `--app-error` (no un hex fijo): `#B04436` en día / `#D06A5C`
 * en noche son exactamente ese token por tema, comprobado contra ambos
 * artboards.
 */
export function Renuncias(): JSX.Element {
  const { t } = useTranslation();
  const motionSafe = useMotionSafe();

  return (
    <section className="flex flex-col gap-[54px] px-6 lg:px-[110px] py-24 border-t border-subtle">
      <div className="flex flex-col gap-3">
        <h2 className="font-extrabold text-[54px] leading-[1.05] tracking-[-0.03em] max-w-[760px] text-text">
          {t('landing2.renuncias.title')}
        </h2>
        <p className="text-lg text-text-muted">{t('landing2.renuncias.subtitle')}</p>
      </div>
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-x-[90px] gap-y-[42px]"
        initial={motionSafe ? { opacity: 0, y: 16 } : undefined}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        {ITEM_KEYS.map((key) => (
          <Fragment key={key}>
            <span
              className="font-extrabold text-[40px] tracking-[-0.025em] text-text-muted line-through"
              style={{ textDecorationThickness: '5px', textDecorationColor: 'var(--app-error)' }}
            >
              {t(`landing2.renuncias.items.${key}.label`)}
            </span>
            <span className="text-lg leading-[1.5] text-text self-center">
              {t(`landing2.renuncias.items.${key}.description`)}
            </span>
          </Fragment>
        ))}
      </motion.div>
    </section>
  );
}
