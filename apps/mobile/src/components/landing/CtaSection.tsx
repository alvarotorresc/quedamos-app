import { useTranslation } from 'react-i18next';
import { useScrollAnimation } from './useScrollAnimation';

interface CtaSectionProps {
  onRegister: () => void;
  onLogin: () => void;
}

export default function CtaSection({ onRegister, onLogin }: CtaSectionProps) {
  const { t } = useTranslation();
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-gradient-radial from-primary/6 to-transparent blur-3xl" />
      </div>

      <div ref={ref} className="landing-animate relative z-10 max-w-2xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
          <span className="landing-gradient-text">{t('landing.cta.title')}</span>
        </h2>
        <p className="text-text-muted text-lg mb-12 font-light">
          {t('landing.cta.subtitle')}
        </p>

        <button
          onClick={onRegister}
          className="group relative rounded-full px-10 py-4 text-base font-semibold bg-primary-dark text-white transition-all duration-300 hover:shadow-2xl hover:shadow-primary-dark/30 hover:-translate-y-0.5"
        >
          <span className="relative z-10">{t('landing.cta.button')}</span>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-dark to-[#7C3AED] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>

        <p className="mt-8 text-text-dark text-sm">
          {t('landing.cta.hasAccount')}{' '}
          <button onClick={onLogin} className="text-primary hover:text-primary/80 transition-colors">
            {t('landing.cta.login')}
          </button>
        </p>
      </div>
    </section>
  );
}
