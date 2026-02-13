import { useTranslation } from 'react-i18next';
import { HiCalendarDays, HiUserGroup, HiMapPin, HiBell } from 'react-icons/hi2';
import { useScrollAnimation } from './useScrollAnimation';

const features = [
  { icon: HiCalendarDays, key: 'calendar', color: '#60A5FA' },
  { icon: HiUserGroup, key: 'groups', color: '#34D399' },
  { icon: HiMapPin, key: 'plans', color: '#F59E0B' },
  { icon: HiBell, key: 'notifications', color: '#F472B6' },
] as const;

export default function FeaturesSection() {
  const { t } = useTranslation();
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section className="py-32 px-6">
      <div ref={ref} className="landing-animate max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <p className="text-primary text-sm font-medium tracking-widest uppercase mb-3">
            {t('landing.features.subtitle')}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-text tracking-tight">
            {t('landing.features.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, key, color }) => (
            <div
              key={key}
              className="landing-glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/12 group cursor-default"
            >
              <div
                className="landing-icon-glow w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${color}12` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="text-text font-semibold text-[15px] mb-2">
                {t(`landing.features.${key}.title`)}
              </h3>
              <p className="text-text-muted text-sm leading-relaxed">
                {t(`landing.features.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
