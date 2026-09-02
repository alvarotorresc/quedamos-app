import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMotionSafe } from '../../lib/motion';
import { CtaArrow, GITHUB_URL } from './NavIsla';
import { FEEDBACK_FORM_URL } from '../../lib/constants';

// Language names stay in their own language on purpose: never translated.
const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
] as const;

/**
 * Cierre (zona 8): cita + CTA + footer. Mismo botón «Abrir Quedamos» que
 * NavIsla/HeroPregunta (comparte `CtaArrow`); «Ver el código en GitHub» enlaza
 * al repo y «Reportar un error» al formulario de feedback; «Español / English»
 * del footer cambia el idioma (el detector de i18n lo persiste).
 */
export function Cierre(): JSX.Element {
  const { t, i18n } = useTranslation();
  const motionSafe = useMotionSafe();
  const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'es';
  return (
    <motion.section
      data-testid="cierre-section"
      className="flex flex-col justify-center gap-[30px] px-6 lg:px-[110px] py-24 border-t border-subtle"
      initial={motionSafe ? { opacity: 0, y: 16 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <p className="font-extrabold text-[46px] leading-[1.15] tracking-[-0.025em] max-w-[820px] text-text">
        {t('landing2.cierre.quote')}
      </p>
      <p className="text-lg text-text-muted">{t('landing2.cierre.subtitle')}</p>
      <Link
        to="/login"
        className="flex items-center gap-2.5 h-14 pl-[26px] pr-2 rounded-pill bg-primary text-on-primary font-bold text-base self-start"
      >
        <span>{t('landing2.cta')}</span>
        <CtaArrow size={40} />
      </Link>
      <div className="flex flex-wrap items-center gap-10 pt-6 border-t border-subtle text-sm text-text-muted">
        <span>{t('landing2.nav.codeOpen')}</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-text">
          {t('landing2.githubCta')}
        </a>
        <a href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer" className="hover:text-text">
          {t('landing2.feedbackCta')}
        </a>
        <span className="flex items-center gap-2" role="group" aria-label="Idioma / Language">
          {LANGUAGES.map(({ code, label }, i) => (
            <span key={code} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              <button
                type="button"
                onClick={() => i18n.changeLanguage(code)}
                aria-pressed={currentLanguage === code}
                className={`bg-transparent border-none p-0 text-sm hover:text-text ${
                  currentLanguage === code ? 'text-text font-semibold' : 'text-text-muted'
                }`}
              >
                {label}
              </button>
            </span>
          ))}
        </span>
      </div>
    </motion.section>
  );
}
