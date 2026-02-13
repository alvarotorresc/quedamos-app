import { useTranslation } from 'react-i18next';
import { HiCheck, HiSparkles } from 'react-icons/hi2';
import { useScrollAnimation } from './useScrollAnimation';

const currentFeatures = [
  'sharedCalendar',
  'groups',
  'events',
  'pushNotifications',
  'realtimeSync',
  'darkLightTheme',
  'multiLanguage',
  'androidWeb',
] as const;

const upcomingFeatures = [
  'ios',
  'aiSuggestions',
  'weather',
  'voting',
  'editEvents',
  'multiAdmin',
] as const;

export default function RoadmapSection() {
  const { t } = useTranslation();
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section className="py-32 px-6">
      <div ref={ref} className="landing-animate max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-medium tracking-widest uppercase mb-3">
            {t('landing.roadmap.subtitle')}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-text tracking-tight">
            {t('landing.roadmap.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Available Now */}
          <div className="landing-glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <HiCheck className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">{t('landing.roadmap.available.title')}</h3>
                <p className="text-xs text-text-muted">{t('landing.roadmap.available.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-3">
              {currentFeatures.map((key, i) => (
                <div
                  key={key}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl bg-success/[0.03] border border-success/[0.06] landing-roadmap-item"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                    <HiCheck className="w-3 h-3 text-success" />
                  </div>
                  <span className="text-sm text-text font-medium">
                    {t(`landing.roadmap.available.features.${key}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Coming Soon */}
          <div className="landing-glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/10 flex items-center justify-center">
                <HiSparkles className="w-5 h-5 text-[#A78BFA]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">{t('landing.roadmap.upcoming.title')}</h3>
                <p className="text-xs text-text-muted">{t('landing.roadmap.upcoming.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-3">
              {upcomingFeatures.map((key, i) => (
                <div
                  key={key}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[#A78BFA]/[0.03] border border-[#A78BFA]/[0.06] landing-roadmap-item"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="w-5 h-5 rounded-full bg-[#A78BFA]/15 flex items-center justify-center flex-shrink-0">
                    <HiSparkles className="w-3 h-3 text-[#A78BFA]" />
                  </div>
                  <span className="text-sm text-text font-medium">
                    {t(`landing.roadmap.upcoming.features.${key}`)}
                  </span>
                  <span className="ml-auto text-[8px] uppercase tracking-wider text-[#A78BFA] font-semibold bg-[#A78BFA]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {t('landing.roadmap.upcoming.badge')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
