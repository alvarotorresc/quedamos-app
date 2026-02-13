import { useTranslation } from 'react-i18next';
import { useScrollAnimation } from './useScrollAnimation';

const memberColors = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399'];
const memberEmojis = ['😊', '🎉', '💜', '🌿'];
const weekDays = [
  { day: 'L', num: 10, members: [0, 2] },
  { day: 'M', num: 11, members: [] },
  { day: 'X', num: 12, members: [0, 1, 3] },
  { day: 'J', num: 13, members: [1] },
  { day: 'V', num: 14, members: [0, 1, 2, 3] },
  { day: 'S', num: 15, members: [0, 3] },
  { day: 'D', num: 16, members: [] },
];

export default function PhoneMockupSection() {
  const { t } = useTranslation();
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section className="py-32 px-6 overflow-hidden">
      <div ref={ref} className="landing-animate max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        {/* Text */}
        <div className="flex-1 text-center lg:text-left">
          <p className="text-primary text-sm font-medium tracking-widest uppercase mb-3">
            {t('landing.mockup.weekLabel')}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-text tracking-tight mb-5">
            {t('landing.mockup.title')}
          </h2>
          <p className="text-text-muted text-lg leading-relaxed max-w-md mx-auto lg:mx-0 font-light">
            {t('landing.mockup.description')}
          </p>

          {/* Stats */}
          <div className="flex gap-8 mt-10 justify-center lg:justify-start">
            {[
              { value: '4', label: 'miembros' },
              { value: '87%', label: 'match' },
              { value: '∞', label: 'quedadas' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl font-bold text-text">{value}</div>
                <div className="text-xs text-text-dark uppercase tracking-wider mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Phone mockup — realistic WeekView */}
        <div className="flex-shrink-0 landing-float">
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-primary/8 rounded-full scale-110" />

            <div className="relative w-[360px] rounded-[48px] border-[3px] border-white/8 bg-[#080E1A] p-6 landing-glow">
              {/* Dynamic Island */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full" />

              {/* Status bar */}
              <div className="flex justify-between items-center px-2 pt-4 mb-4">
                <span className="text-[11px] text-text-muted font-medium">9:41</span>
                <div className="flex gap-1.5 items-center">
                  <div className="flex gap-[2px]">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`w-[3px] rounded-sm ${i <= 3 ? 'bg-text-muted' : 'bg-text-dark/30'}`} style={{ height: 4 + i * 2 }} />
                    ))}
                  </div>
                  <span className="text-[9px] text-text-muted ml-1">5G</span>
                  <div className="w-5 h-2.5 rounded-sm border border-text-muted/50 relative ml-0.5">
                    <div className="absolute inset-[1.5px] bg-success rounded-[1px]" style={{ width: '65%' }} />
                  </div>
                </div>
              </div>

              {/* App header */}
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[11px] text-text-dark">‹</span>
                <span className="text-xs text-text-dark font-semibold capitalize">{t('landing.mockup.monthLabel')}</span>
                <span className="text-[11px] text-text-dark">›</span>
              </div>

              {/* Week day cards — matches real WeekView */}
              <div className="space-y-[5px] mb-4">
                {weekDays.map(({ day, num, members }) => {
                  const isSelected = num === 14;
                  const isToday = num === 13;
                  return (
                    <div
                      key={day}
                      className="rounded-[14px] px-3.5 py-3"
                      style={{
                        background: isSelected ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.015)',
                        border: `1px solid ${isSelected ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.035)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="min-w-[32px] text-center">
                            <div className="text-[8px] text-text-dark font-semibold uppercase tracking-wide">{day}</div>
                            <div className={`text-[17px] font-bold leading-tight ${isToday ? 'text-primary' : 'text-[#CBD5E1]'}`}>
                              {num}
                            </div>
                          </div>
                          {members.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {members.map((mi) => (
                                <div
                                  key={mi}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] border-[1.5px] border-[#080E1A]"
                                  style={{ backgroundColor: memberColors[mi] + '25' }}
                                >
                                  {memberEmojis[mi]}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px]" style={{ color: members.length > 0 ? '#64748B' : '#334155' }}>
                            {members.length > 0 ? `${members.length}/4` : '—'}
                          </span>
                          {members.some((mi) => mi === 0) && (
                            <div className="text-[8px] text-primary mt-0.5">{t('calendar.allDay')}</div>
                          )}
                        </div>
                      </div>

                      {/* Selected day buttons */}
                      {isSelected && (
                        <div className="flex gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="flex-1 py-1.5 text-[10px] font-semibold rounded-[11px] bg-primary-dark text-white text-center">
                            {t('calendar.editAvailability')}
                          </div>
                          <div className="flex-1 py-1.5 text-[10px] font-semibold rounded-[11px] text-center" style={{ background: 'rgba(255,255,255,0.04)', color: '#7B8CA8', border: '1px solid rgba(255,255,255,0.07)' }}>
                            {t('calendar.createEvent')}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Best day card */}
              <div className="rounded-[14px] border border-success/15 bg-success/[0.04] p-3.5 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[9px] text-success font-semibold tracking-wide uppercase">{t('landing.mockup.bestDay')}</span>
                </div>
                <p className="text-[12px] text-text font-medium">{t('landing.mockup.bestDayDate')}</p>
                <div className="flex gap-1.5 mt-2">
                  {memberColors.map((c, i) => (
                    <div
                      key={c}
                      className="w-5 h-5 rounded-full text-[8px] flex items-center justify-center"
                      style={{ backgroundColor: c + '20' }}
                    >
                      {memberEmojis[i]}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex justify-around items-center border-t border-white/5 pt-3 pb-1">
                {[
                  { icon: '📅', label: t('tabs.calendar'), active: true },
                  { icon: '📋', label: t('tabs.plans'), active: false },
                  { icon: '👥', label: t('tabs.group'), active: false },
                  { icon: '👤', label: t('tabs.profile'), active: false },
                ].map(({ icon, label, active }, i) => (
                  <div key={i} className={`text-center ${active ? '' : 'opacity-30'}`}>
                    <span className="text-[13px] block">{icon}</span>
                    <span className={`text-[8px] block mt-0.5 ${active ? 'text-primary' : 'text-text-dark'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
