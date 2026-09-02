import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateEvent } from '../hooks/useEvents';
import { useGroup } from '../hooks/useGroups';
import { useForecast } from '../hooks/useWeather';
import { useAuthStore } from '../stores/auth';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { Toggle } from '../ui/Toggle';
import { Avatar } from '../ui/Avatar';
import { WeatherBadge } from './WeatherWidget';
import { LocationSearch } from './LocationSearch';
import { formatDateKey, capitalizeFirst } from '../lib/date-utils';
import type { WeatherData } from '../services/weather';
import { getMemberColorByUserId } from '../lib/constants';
import { buildMemberColorMap } from '../lib/member-colors';
import { useToast } from '../hooks/useToast';
import { runWithErrorToast } from '../lib/mutation-utils';

export interface EventPrefill {
  date: string;
  dateLabel: string;
  weekday: string;
  suggestedTime: string | null;
  suggestedSlot: string | null;
  availableMembers: { userId: string; name: string; color: string }[];
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
  const { showError } = useToast();
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
  const [isOnline, setIsOnline] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');

  const isCreating = createEvent.isPending;
  const endTimeError = !!(endTime && time && endTime <= time);
  const resolvedDate = prefill?.date ?? date;
  const canSubmit = title.trim() && resolvedDate && !isCreating && !endTimeError;

  const forecast = useForecast(
    groupId,
    !isOnline && resolvedDate ? resolvedDate : null,
    locationLat,
    locationLon,
  );

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
      setTitle(prefill ? t('plans.create.defaultTitle', { weekday: prefill.weekday }) : '');
      setDescription('');
      setLocation('');
      setLocationLat(null);
      setLocationLon(null);
      setTime(prefill?.suggestedTime ?? '');
      setEndTime('');
      setDate('');
      setSelectedMemberIds(
        prefill ? new Set(prefill.availableMembers.map((m) => m.userId)) : new Set(),
      );
      setShowMemberSelector(false);
      setIsOnline(false);
      setMeetingUrl('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    await runWithErrorToast(
      () =>
        createEvent.mutateAsync({
          title: title.trim(),
          date: resolvedDate,
          ...(time && { time }),
          ...(endTime && { endTime }),
          ...(description.trim() && { description: description.trim() }),
          ...(!isOnline && location.trim() && { location: location.trim() }),
          ...(!isOnline &&
            locationLat != null &&
            locationLon != null && { locationLat, locationLon }),
          ...(selectedMemberIds.size > 0 && { attendeeIds: [...selectedMemberIds] }),
          ...(isOnline && { isOnline: true }),
          ...(isOnline && meetingUrl.trim() && { meetingUrl: meetingUrl.trim() }),
        }),
      showError,
      { onSuccess: resetAndClose, errorKey: 'errors.createEventFailed' },
    );
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
    setIsOnline(false);
    setMeetingUrl('');
    onClose();
  };

  const fieldLabelClass =
    'block font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted mb-1.5';
  const underlineInputClass =
    'w-full bg-transparent border-0 border-b-[1.5px] border-strong text-sm text-text outline-none placeholder:text-text-dark py-2';
  const underlineFieldStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1.5px solid var(--app-border-strong)',
    borderRadius: 0,
    padding: '8px 0',
  };

  // Other members (excluding current user)
  const otherMembers = members.filter((m) => m.userId !== user?.id);

  // Member color map (userId -> color), by join order within the group
  const colorMap = useMemo(() => buildMemberColorMap(members), [members]);

  // Whether the live selection still exactly matches the prefill's "who can" set —
  // used to decide whether the chips summary would just duplicate the whoCan row above.
  const prefillIds = new Set((prefill?.availableMembers ?? []).map((m) => m.userId));
  const selectionMatchesPrefill =
    prefill != null &&
    selectedMemberIds.size === prefillIds.size &&
    [...selectedMemberIds].every((id) => prefillIds.has(id));

  return (
    <Sheet
      isOpen={isOpen}
      onClose={resetAndClose}
      title={t('plans.create.title')}
      subtitle={
        prefill ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {capitalizeFirst(prefill.dateLabel)} · {prefill.availableCount} {t('plans.create.available')}
            </span>
            {!isOnline && weatherToShow && weatherToShow.length > 0 && (
              <div className="flex items-center gap-1.5">
                {weatherToShow.map((w) => (
                  <WeatherBadge key={w.city} weatherCode={w.weatherCode} tempMax={w.tempMax} />
                ))}
              </div>
            )}
          </div>
        ) : undefined
      }
      footer={
        <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {isCreating ? t('plans.create.creating') : t('plans.create.submit')}
        </Button>
      }
    >
        {/* Date — only shown when not coming from calendar */}
        {!prefill && (
          <div className="mb-3">
            <label className={fieldLabelClass}>{t('plans.create.date')}</label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className={underlineInputClass}
            />
          </div>
        )}

        {/* Title */}
        <div className="mb-3">
          <label className={fieldLabelClass}>{t('plans.create.name')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('plans.create.namePlaceholder')}
            className={underlineInputClass}
          />
        </div>

        {/* Online toggle */}
        <div className="mb-3">
          <div className="flex items-center justify-between border-b-[1.5px] border-strong py-2">
            <span className="text-sm text-text">{t('online.toggle')}</span>
            <Toggle checked={isOnline} onChange={setIsOnline} label={t('online.toggle')} />
          </div>
        </div>

        {/* Location or Meeting URL */}
        {isOnline ? (
          <div className="mb-3">
            <label className={fieldLabelClass}>
              {t('online.meetingUrl')}
              <span className="ml-1 normal-case opacity-60">({t('common.optional')})</span>
            </label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder={t('online.meetingUrlPlaceholder')}
              className={underlineInputClass}
            />
          </div>
        ) : (
          <div className="mb-3">
            <label className={fieldLabelClass}>{t('plans.create.location')}</label>
            <LocationSearch
              value={location}
              placeholder={t('plans.create.locationOptional')}
              style={underlineFieldStyle}
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
        )}

        {/* Weather badge for direct open (no prefill) with date selected */}
        {!isOnline && !prefill && weatherToShow && weatherToShow.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            {weatherToShow.map((w) => (
              <WeatherBadge key={w.city} weatherCode={w.weatherCode} tempMax={w.tempMax} />
            ))}
          </div>
        )}

        {/* Description */}
        <div className="mb-3">
          <label className={fieldLabelClass}>
            {t('plans.create.description')}
            <span className="ml-1 normal-case opacity-60">({t('common.optional')})</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('plans.create.descriptionPlaceholder')}
            rows={2}
            className={`${underlineInputClass} resize-none`}
          />
        </div>

        {/* Time */}
        <div className="mb-3">
          <label className={fieldLabelClass}>
            {t('plans.create.time')}
            {!prefill?.suggestedTime && (
              <span className="ml-1 normal-case opacity-60">({t('common.optional')})</span>
            )}
            {prefill?.suggestedTime && prefill?.suggestedSlot && (
              <span className="ml-1.5 normal-case text-primary">
                · {t('plans.create.suggested')}:{' '}
                {t(`calendar.availability.${prefill.suggestedSlot}`)}
              </span>
            )}
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={underlineInputClass}
          />
        </div>

        {/* End Time */}
        <div className="mb-4">
          <label className={fieldLabelClass}>
            {t('plans.create.endTime')}
            <span className="ml-1 normal-case opacity-60">({t('common.optional')})</span>
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            min={time || undefined}
            className={underlineInputClass}
          />
          {endTimeError && (
            <p className="text-[10px] text-danger mt-1">{t('plans.create.endTimeError')}</p>
          )}
        </div>

        {/* "Who can" row — display-only preview of who marked themselves available
            for this day. Editing who actually gets invited still happens below,
            via the group member selector (shared selectedMemberIds). */}
        {prefill && prefill.availableMembers.length > 0 && (
          <div className="mb-4">
            <label className={fieldLabelClass}>{t('plans.create.whoCan')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {prefill.availableMembers.map((m) => (
                <Avatar key={m.userId} name={m.name} color={m.color} size={30} />
              ))}
            </div>
          </div>
        )}

        {/* Member selector — lets you customize attendees beyond the "who can" default,
            including inviting members who haven't marked availability yet. */}
        {otherMembers.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowMemberSelector(!showMemberSelector)}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted mb-1.5 bg-transparent border-none p-0 cursor-pointer"
            >
              <span>{t('plans.create.selectAttendees')}</span>
              <span className="ml-1 normal-case opacity-60">({t('common.optional')})</span>
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
                {otherMembers.map((m) => {
                  const isSelected = selectedMemberIds.has(m.userId);
                  const color = colorMap.get(m.userId) ?? getMemberColorByUserId(m.userId);
                  return (
                    <button
                      key={m.userId}
                      onClick={() => toggleMember(m.userId)}
                      className="flex items-center gap-2 w-full text-left rounded-[10px] py-1.5 px-2 border-none cursor-pointer"
                      style={{
                        background: isSelected
                          ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)'
                          : 'transparent',
                        border: isSelected
                          ? '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)'
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

            {(!prefill || !selectionMatchesPrefill) &&
              selectedMemberIds.size > 0 &&
              !showMemberSelector && (
              <div className="flex gap-1 flex-wrap">
                {[...selectedMemberIds].map((id) => {
                  const m = members.find((mem) => mem.userId === id);
                  const color = colorMap.get(id) ?? getMemberColorByUserId(id);
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

    </Sheet>
  );
}
