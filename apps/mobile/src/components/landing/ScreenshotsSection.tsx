import { useTranslation } from 'react-i18next';
import { useScrollAnimation } from './useScrollAnimation';

const memberColors = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];
const memberEmojis = ['😊', '🎉', '💜', '🌿', '⭐', '🔥'];
const memberNames = ['Álvaro', 'Misa', 'Sara', 'Juan'];

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="landing-screenshot-wrapper">
      <p className="text-sm text-text-muted text-center mb-4 font-medium">{label}</p>
      <div className="relative mx-auto">
        <div className="absolute inset-0 blur-2xl bg-primary/5 rounded-full scale-105" />
        <div className="relative w-[280px] h-[560px] mx-auto rounded-[36px] border-2 border-white/8 bg-[#080E1A] p-4 landing-glow flex flex-col">
          {/* Dynamic Island */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-black rounded-full" />
          {/* Status bar */}
          <div className="flex justify-between items-center px-2 pt-3 mb-3 flex-shrink-0">
            <span className="text-[9px] text-text-muted font-medium">9:41</span>
            <div className="flex gap-1 items-center">
              <div className="w-4 h-2 rounded-sm border border-text-muted/40 relative">
                <div className="absolute inset-[1px] bg-success rounded-[1px]" style={{ width: '65%' }} />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">{children}</div>
          {/* Tab bar */}
          <div className="flex justify-around items-center border-t border-white/5 pt-2.5 pb-0.5 mt-3 flex-shrink-0">
            {['📅', '📋', '👥', '👤'].map((icon, i) => (
              <span key={i} className={`text-[11px] ${i === 0 ? '' : 'opacity-25'}`}>{icon}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarScreen() {
  const { t } = useTranslation();
  const days = [
    { day: 'L', num: 10, avail: [0, 2] },
    { day: 'M', num: 11, avail: [] },
    { day: 'X', num: 12, avail: [0, 1, 3] },
    { day: 'J', num: 13, avail: [1] },
    { day: 'V', num: 14, avail: [0, 1, 2, 3] },
    { day: 'S', num: 15, avail: [0, 3] },
    { day: 'D', num: 16, avail: [] },
  ];

  return (
    <>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] text-text-dark">‹</span>
        <span className="text-[10px] text-text-dark font-semibold capitalize">{t('landing.mockup.monthLabel')}</span>
        <span className="text-[10px] text-text-dark">›</span>
      </div>

      {/* Week cards */}
      <div className="space-y-1">
        {days.map(({ day, num, avail }) => {
          const isToday = num === 13;
          return (
            <div
              key={day}
              className="rounded-[11px] px-2.5 py-2"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.035)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="min-w-[24px] text-center">
                    <div className="text-[7px] text-text-dark font-semibold uppercase tracking-wide">{day}</div>
                    <div className={`text-[14px] font-bold leading-tight ${isToday ? 'text-primary' : 'text-[#CBD5E1]'}`}>{num}</div>
                  </div>
                  {avail.length > 0 && (
                    <div className="flex -space-x-1">
                      {avail.map((mi) => (
                        <div
                          key={mi}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[6px] border border-[#080E1A]"
                          style={{ backgroundColor: memberColors[mi] + '25' }}
                        >
                          {memberEmojis[mi]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[8px]" style={{ color: avail.length > 0 ? '#64748B' : '#334155' }}>
                  {avail.length > 0 ? `${avail.length}/4` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Best day */}
      <div className="rounded-[11px] border border-success/15 bg-success/[0.04] p-2.5 mt-2">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[7px] text-success font-semibold uppercase tracking-wide">{t('landing.mockup.bestDay')}</span>
        </div>
        <p className="text-[9px] text-text font-medium">{t('landing.mockup.bestDayDate')}</p>
      </div>
    </>
  );
}

function EventsScreen() {
  const { t } = useTranslation();
  const events = [
    {
      title: t('landing.screenshots.events.event1'),
      date: 'Viernes, 14 febrero',
      time: '19:00',
      location: t('landing.screenshots.events.location1'),
      status: 'confirmed' as const,
      confirmed: [0, 1, 2, 3],
      declined: [],
    },
    {
      title: t('landing.screenshots.events.event2'),
      date: 'Domingo, 16 febrero',
      time: '11:00',
      location: t('landing.screenshots.events.location2'),
      status: 'pending' as const,
      confirmed: [0, 1],
      declined: [2],
    },
  ];

  const statusColors = { confirmed: '#34D399', pending: '#F59E0B' };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[13px] font-bold text-text">{t('landing.screenshots.events.title')}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-3 px-1">
        <span className="text-[9px] text-primary font-semibold pb-1" style={{ borderBottom: '2px solid #60A5FA' }}>
          {t('landing.screenshots.events.upcoming')}
        </span>
        <span className="text-[9px] text-text-dark/40">{t('landing.screenshots.events.past')}</span>
      </div>

      {/* Event cards */}
      <div className="space-y-2.5">
        {events.map((ev, i) => (
          <div key={i} className="rounded-[14px] p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Title + badge */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-text leading-snug flex-1">{ev.title}</span>
              <span
                className="text-[7px] px-1.5 py-[2px] rounded-full font-semibold whitespace-nowrap"
                style={{ backgroundColor: statusColors[ev.status] + '18', color: statusColors[ev.status] }}
              >
                {ev.status === 'confirmed' ? t('landing.screenshots.events.confirmed') : t('landing.screenshots.events.pending')}
              </span>
            </div>

            {/* Date + time */}
            <div className="flex items-center gap-2 text-[8px] text-text-muted mb-1">
              <span>{ev.date}</span>
              <span>·</span>
              <span>{ev.time}</span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1 text-[8px] text-text-muted mb-2">
              <span>📍</span>
              <span>{ev.location}</span>
            </div>

            {/* Attendees */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] text-success font-semibold">{ev.confirmed.length}/{ev.confirmed.length + ev.declined.length + (4 - ev.confirmed.length - ev.declined.length)}</span>
                <div className="flex -space-x-1">
                  {ev.confirmed.map((mi) => (
                    <div
                      key={mi}
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[6px] border border-[#080E1A]"
                      style={{ backgroundColor: memberColors[mi] + '25' }}
                    >
                      {memberEmojis[mi]}
                    </div>
                  ))}
                </div>
              </div>
              {ev.declined.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-[#FB7185] font-semibold">{ev.declined.length}/{4}</span>
                  <div className="flex -space-x-1">
                    {ev.declined.map((mi) => (
                      <div
                        key={mi}
                        className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[6px] border border-[#080E1A]"
                        style={{ backgroundColor: memberColors[mi] + '25' }}
                      >
                        {memberEmojis[mi]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirmed banner for first event */}
            {i === 0 && (
              <div
                className="mt-2.5 py-1.5 rounded-[11px] text-[8px] font-semibold text-center"
                style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.15)' }}
              >
                {t('plans.youConfirmed')}
              </div>
            )}

            {/* Action buttons for second event */}
            {i === 1 && (
              <div className="flex gap-1.5 mt-2.5">
                <div className="flex-1 py-1.5 text-[8px] font-semibold rounded-[11px] bg-primary-dark text-white text-center">
                  {t('plans.confirm')}
                </div>
                <div
                  className="flex-1 py-1.5 text-[8px] font-semibold rounded-[11px] text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#FB7185', border: '1px solid rgba(251,113,133,0.15)' }}
                >
                  {t('plans.decline')}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function GroupScreen() {
  const { t } = useTranslation();

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-[11px] text-text-dark">‹</span>
        <span className="text-[13px] font-bold text-text">🏔️ {t('landing.screenshots.group.name')}</span>
      </div>

      {/* Members section */}
      <div className="mb-3">
        <span className="text-[8px] font-semibold text-text-dark uppercase tracking-wider block mb-2 px-1">
          {t('group.members')} (4)
        </span>
        <div className="space-y-1.5">
          {memberNames.map((name, i) => (
            <div
              key={name}
              className="flex items-center gap-2.5 rounded-[11px] px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px]"
                style={{ backgroundColor: memberColors[i] + '20' }}
              >
                {memberEmojis[i]}
              </div>
              <span className="text-[10px] text-text font-medium flex-1">{name}</span>
              {i === 0 && <span className="text-[8px] text-text-muted">({t('group.memberYou')})</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Invite section */}
      <div className="rounded-[14px] p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-[8px] font-semibold text-text-dark uppercase tracking-wider block mb-1">
          {t('landing.screenshots.group.inviteCode')}
        </span>
        <div className="text-[16px] font-mono font-bold text-text tracking-[0.2em] mb-2.5">
          A7K9-M2P4
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 py-1.5 text-[8px] font-semibold rounded-[11px] text-center" style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)' }}>
            {t('group.copyCode')}
          </div>
          <div className="flex-1 py-1.5 text-[8px] font-semibold rounded-[11px] text-center" style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.07)' }}>
            {t('group.share')}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ScreenshotsSection() {
  const { t } = useTranslation();
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section className="py-32 px-6 overflow-hidden">
      <div ref={ref} className="landing-animate max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-medium tracking-widest uppercase mb-3">
            {t('landing.screenshots.subtitle')}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-text tracking-tight">
            {t('landing.screenshots.title')}
          </h2>
        </div>

        <div className="flex flex-col md:flex-row items-start justify-center gap-8 md:gap-6">
          <PhoneFrame label={t('landing.screenshots.calendar.label')}>
            <CalendarScreen />
          </PhoneFrame>
          <PhoneFrame label={t('landing.screenshots.events.label')}>
            <EventsScreen />
          </PhoneFrame>
          <PhoneFrame label={t('landing.screenshots.group.label')}>
            <GroupScreen />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
