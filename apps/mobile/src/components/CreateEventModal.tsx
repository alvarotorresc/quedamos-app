import { useState, useEffect } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useCreateEvent } from '../hooks/useEvents';
import { useGroup } from '../hooks/useGroups';
import { useForecast } from '../hooks/useWeather';
import { useAuthStore } from '../stores/auth';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { WeatherBadge } from './WeatherWidget';
import { LocationSearch } from './LocationSearch';
import { formatDateKey } from '../lib/date-utils';
import type { WeatherData } from '../services/weather';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

export interface EventPrefill {
  date: string;
  dateLabel: string;
  suggestedTime: string | null;
  suggestedSlot: string | null;
  availableMembers: { name: string; color: string }[];
  availableCount: number;
  weather?: WeatherData[] | null;
}

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  prefill: EventPrefill | null;
  weatherByDate?: Map<string, WeatherData[]>;
}

export function CreateEventModal({
  isOpen,
  onClose,
  groupId,
  prefill,
  weatherByDate,
}: CreateEventModalProps) {
  const { t } = useTranslation();
  const createEvent = useCreateEvent(groupId);
  const user = useAuthStore((s) => s.user);
  const { data: groupDetail } = useGroup(groupId);
  const members = groupDetail?.members ?? [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLon, setLocationLon] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [date, setDate] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  const isCreating = createEvent.isPending;
  const endTimeError = !!(endTime && time && endTime <= time);
  const resolvedDate = prefill?.date ?? date;
  const canSubmit = title.trim() && resolvedDate && !isCreating && !endTimeError;

  const forecast = useForecast(groupId, resolvedDate || null, locationLat, locationLon);

  const weatherToShow: WeatherData[] | null =
    locationLat !== null && locationLon !== null && resolvedDate
      ? forecast.data
        ? [forecast.data]
        : null
      : resolvedDate
        ? (prefill?.weather ?? weatherByDate?.get(resolvedDate) ?? null)
        : null;

  const today = formatDateKey(new Date());

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setLocation('');
      setLocationLat(null);
      setLocationLon(null);
      setTime(prefill?.suggestedTime ?? '');
      setEndTime('');
      setDate('');
      setSelectedMemberIds(new Set());
      setShowMemberSelector(false);
    }
  }, [isOpen, prefill]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await createEvent.mutateAsync({
      title: title.trim(),
      date: resolvedDate,
      ...(time && { time }),
      ...(endTime && { endTime }),
      ...(description.trim() && { description: description.trim() }),
      ...(location.trim() && { location: location.trim() }),
      ...(locationLat != null && locationLon != null && { locationLat, locationLon }),
      ...(selectedMemberIds.size > 0 && { attendeeIds: [...selectedMemberIds] }),
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setLocationLat(null);
    setLocationLon(null);
    setTime('');
    setEndTime('');
    setDate('');
    setSelectedMemberIds(new Set());
    setShowMemberSelector(false);
    onClose();
  };

  const inputStyle = {
    background: 'var(--app-bg-hover)',
    border: '1px solid var(--app-border-strong)',
  };

  // Other members (excluding current user)
  const otherMembers = members.filter((m) => m.userId !== user?.id);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={resetAndClose}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      className="create-event-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-0.5">{t('plans.create.title')}</h3>
        {prefill ? (
          <div className="flex items-center gap-2 mb-3.5 flex-wrap">
            <p className="text-xs text-text-dark capitalize">
              {prefill.dateLabel} · {prefill.availableCount} {t('plans.create.available')}
            </p>
            {weatherToShow && weatherToShow.length > 0 && (
              <div className="flex items-center gap-1.5">
                {weatherToShow.map((w) => (
                  <WeatherBadge key={w.city} weatherCode={w.weatherCode} tempMax={w.tempMax} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-3.5 mb-0.5" />
        )}

        {/* Date — only shown when not coming from calendar */}
        {!prefill && (
          <div className="mb-2">
            <label className="block text-[10px] text-text-dark mb-1">
              {t('plans.create.date')}
            </label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
              style={inputStyle}
            />
          </div>
        )}

        {/* Title */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">{t('plans.create.name')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('plans.create.namePlaceholder')}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
            style={inputStyle}
          />
        </div>

        {/* Location */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.location')}
            <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
          </label>
          <LocationSearch
            value={location}
            placeholder={t('plans.create.locationPlaceholder')}
            style={inputStyle}
            onChange={(text) => {
              setLocation(text);
              setLocationLat(null);
              setLocationLon(null);
            }}
            onSelect={(name, lat, lon) => {
              setLocation(name);
              setLocationLat(lat);
              setLocationLon(lon);
            }}
            onClear={() => {
              setLocation('');
              setLocationLat(null);
              setLocationLon(null);
            }}
          />
        </div>

        {/* Weather badge for direct open (no prefill) with date selected */}
        {!prefill && weatherToShow && weatherToShow.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            {weatherToShow.map((w) => (
              <WeatherBadge key={w.city} weatherCode={w.weatherCode} tempMax={w.tempMax} />
            ))}
          </div>
        )}

        {/* Description */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.description')}
            <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('plans.create.descriptionPlaceholder')}
            rows={2}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark resize-none"
            style={inputStyle}
          />
        </div>

        {/* Time */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.time')}
            {!prefill?.suggestedTime && (
              <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
            )}
            {prefill?.suggestedTime && prefill?.suggestedSlot && (
              <span className="ml-1.5 text-primary">
                · {t('plans.create.suggested')}:{' '}
                {t(`calendar.availability.${prefill.suggestedSlot}`)}
              </span>
            )}
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
        </div>

        {/* End Time */}
        <div className="mb-3">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.endTime')}
            <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            min={time || undefined}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
          {endTimeError && (
            <p className="text-[10px] text-danger mt-1">{t('plans.create.endTimeError')}</p>
          )}
        </div>

        {/* Member selector */}
        {otherMembers.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowMemberSelector(!showMemberSelector)}
              className="flex items-center gap-1.5 text-[10px] text-text-dark mb-1.5 bg-transparent border-none p-0 cursor-pointer"
            >
              <span>{t('plans.create.selectAttendees')}</span>
              <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
              <span
                className="transition-transform text-[8px]"
                style={{ transform: showMemberSelector ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                ▶
              </span>
            </button>

            {showMemberSelector && (
              <div className="space-y-1.5">
                {selectedMemberIds.size === 0 && (
                  <p className="text-[10px] text-text-dark">
                    {t('plans.create.allMembersDefault')}
                  </p>
                )}
                {otherMembers.map((m, i) => {
                  const isSelected = selectedMemberIds.has(m.userId);
                  const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                  return (
                    <button
                      key={m.userId}
                      onClick={() => toggleMember(m.userId)}
                      className="flex items-center gap-2 w-full text-left rounded-[10px] py-1.5 px-2 border-none cursor-pointer"
                      style={{
                        background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                        border: isSelected
                          ? '1px solid rgba(96,165,250,0.2)'
                          : '1px solid var(--app-border)',
                      }}
                    >
                      <Avatar name={m.user?.name ?? '?'} color={color} size={24} />
                      <span className="text-xs text-text flex-1">{m.user?.name ?? '?'}</span>
                      {isSelected && <span className="text-primary text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedMemberIds.size > 0 && !showMemberSelector && (
              <div className="flex gap-1 flex-wrap">
                {[...selectedMemberIds].map((id) => {
                  const m = members.find((mem) => mem.userId === id);
                  const idx = members.findIndex((mem) => mem.userId === id);
                  const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5"
                      style={{
                        background: 'var(--app-bg-card)',
                        border: '1px solid var(--app-border)',
                      }}
                    >
                      <Avatar name={m?.user?.name ?? '?'} color={color} size={20} />
                      <span className="text-[11px] text-text-muted">{m?.user?.name ?? '?'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Prefill attendees (from calendar) - informational only */}
        {prefill && prefill.availableMembers.length > 0 && selectedMemberIds.size === 0 && (
          <div className="mb-4">
            <label className="block text-[10px] text-text-dark mb-1.5">
              {t('plans.create.attendees')}
            </label>
            <div className="flex gap-1 flex-wrap">
              {prefill.availableMembers.map((m, i) => (
                <div
                  key={`${m.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5"
                  style={{
                    background: 'var(--app-bg-card)',
                    border: '1px solid var(--app-border)',
                  }}
                >
                  <Avatar name={m.name} color={m.color} size={20} />
                  <span className="text-[11px] text-text-muted">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {isCreating ? t('plans.create.creating') : t('plans.create.submit')}
        </Button>
      </div>
    </IonModal>
  );
}
