import { useTranslation } from 'react-i18next';
import logo from '../../assets/logo.svg';
import { useScrollAnimation } from './useScrollAnimation';

interface HeroSectionProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function HeroSection({ onLogin, onRegister }: HeroSectionProps) {
  const { t } = useTranslation();
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      {/* Background orbs */}
      <div className="absolute top-[-30%] right-[-15%] w-[800px] h-[800px] rounded-full bg-gradient-radial from-primary/6 to-transparent pointer-events-none blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-radial from-[#A78BFA]/5 to-transparent pointer-events-none blur-3xl" />
      <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] rounded-full bg-gradient-radial from-[#F472B6]/4 to-transparent pointer-events-none blur-3xl" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 landing-grid opacity-50" />

      <div ref={ref} className="landing-animate relative z-10 text-center max-w-3xl mx-auto">
        {/* Logo with glow */}
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full scale-150" />
          <img src={logo} alt="¿Quedamos?" className="relative w-16 h-16" />
        </div>

        {/* Title with gradient */}
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight leading-none pb-2">
          <span className="landing-gradient-text">{t('landing.hero.title')}</span>
        </h1>

        <p className="text-text-muted text-lg md:text-xl mt-6 mb-12 max-w-lg mx-auto leading-relaxed font-light">
          {t('landing.hero.tagline')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={onRegister}
            className="group relative rounded-full px-8 py-3.5 text-sm font-semibold bg-primary-dark text-white transition-all duration-300 hover:shadow-2xl hover:shadow-primary-dark/30 hover:-translate-y-0.5"
          >
            <span className="relative z-10">{t('landing.hero.cta')}</span>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-dark to-[#7C3AED] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
          <button
            onClick={onLogin}
            className="rounded-full px-8 py-3.5 text-sm font-medium text-text-muted transition-all duration-200 hover:text-text hover:bg-white/5"
          >
            {t('landing.hero.login')} →
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <div className="w-5 h-8 rounded-full border border-text-dark/30 flex justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-text-dark/50 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
