import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import logo from '../assets/logo.svg';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import PhoneMockupSection from '../components/landing/PhoneMockupSection';
import ScreenshotsSection from '../components/landing/ScreenshotsSection';
import RoadmapSection from '../components/landing/RoadmapSection';
import CtaSection from '../components/landing/CtaSection';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="h-screen bg-bg text-text overflow-x-hidden overflow-y-auto">
      {/* Sticky header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-bg/70 backdrop-blur-2xl border-b border-[var(--app-border)] shadow-lg shadow-black/5'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="¿Quedamos?" className="w-7 h-7" />
            <span className="font-bold text-text text-base tracking-tight">{t('landing.brand')}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onLogin}
              className="text-sm text-text-muted hover:text-text transition-colors duration-200"
            >
              {t('landing.header.login')}
            </button>
            <button
              onClick={onRegister}
              className="rounded-full px-5 py-2 text-sm font-medium bg-primary-dark text-white transition-all duration-200 hover:shadow-lg hover:shadow-primary-dark/25 hover:-translate-y-px"
            >
              {t('landing.header.register')}
            </button>
          </div>
        </div>
      </header>

      {/* Sections */}
      <HeroSection onLogin={onLogin} onRegister={onRegister} />

      <div className="landing-grid">
        <FeaturesSection />
        <PhoneMockupSection />
      </div>

      <ScreenshotsSection />

      <div className="landing-grid">
        <RoadmapSection />
      </div>

      <CtaSection onRegister={onRegister} onLogin={onLogin} />

      {/* Footer */}
      <footer className="py-10 text-center border-t border-[var(--app-border)]">
        <p className="text-text-dark text-sm">
          {t('landing.footer.madeWith')}{' '}
          <span className="text-red-400">❤️</span>{' '}
          {t('landing.footer.by')}{' '}
          <a
            href="https://github.com/alvarotorresc/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Alvaro Torres
          </a>
        </p>
        <p className="text-text-dark/50 text-xs mt-2 uppercase tracking-wide">¿Quedamos? &copy; 2026</p>
      </footer>
    </div>
  );
}
