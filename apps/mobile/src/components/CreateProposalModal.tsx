import { useState, useEffect } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useCreateProposal } from '../hooks/useProposals';
import { useForecast } from '../hooks/useWeather';
import { Button } from '../ui/Button';
import { WeatherBadge } from './WeatherWidget';
import { LocationSearch } from './LocationSearch';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function CreateProposalModal({ isOpen, onClose, groupId }: CreateProposalModalProps) {
  const { t } = useTranslation();
  const createProposal = useCreateProposal(groupId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLon, setLocationLon] = useState<number | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');

  const isCreating = createProposal.isPending;
  const canSubmit = title.trim() && !isCreating;

  const forecast = useForecast(
    groupId,
    !isOnline && proposedDate ? proposedDate : null,
    locationLat,
    locationLon,
  );

  const weatherToShow =
    locationLat !== null && locationLon !== null && proposedDate
      ? forecast.data
        ? [forecast.data]
        : null
      : null;

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setLocation('');
      setLocationLat(null);
      setLocationLon(null);
      setProposedDate('');
      setIsOnline(false);
      setMeetingUrl('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await createProposal.mutateAsync({
      title: title.trim(),
      ...(description.trim() && { description: description.trim() }),
      ...(!isOnline && location.trim() && { location: location.trim() }),
      ...(proposedDate && { proposedDate }),
      ...(isOnline && { isOnline: true }),
      ...(isOnline && meetingUrl.trim() && { meetingUrl: meetingUrl.trim() }),
    });
    onClose();
  };

  const handleDismiss = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setLocationLat(null);
    setLocationLon(null);
    setProposedDate('');
    setIsOnline(false);
    setMeetingUrl('');
    onClose();
  };

  const inputStyle = {
    background: 'var(--app-bg-hover)',
    border: '1px solid var(--app-border-strong)',
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={handleDismiss}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      className="create-proposal-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-3.5">{t('proposals.create')}</h3>

        {/* Title */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">{t('plans.create.name')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('proposals.titlePlaceholder')}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('proposals.description')}
            <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('proposals.descriptionPlaceholder')}
            rows={3}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark resize-none"
            style={inputStyle}
          />
        </div>

        {/* Online toggle */}
        <div className="mb-2">
          <div
            className="flex items-center justify-between rounded-[10px] px-3 py-2.5"
            style={inputStyle}
          >
            <span className="text-sm text-text">{t('online.toggle')}</span>
            <button
              type="button"
              onClick={() => setIsOnline(!isOnline)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isOnline ? 'bg-primary-tint' : 'bg-toggle-off'}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${isOnline ? 'left-5 bg-primary' : 'left-0.5 bg-text-dark'}`}
              />
            </button>
          </div>
        </div>

        {/* Location or Meeting URL */}
        {isOnline ? (
          <div className="mb-2">
            <label className="block text-[10px] text-text-dark mb-1">
              {t('online.meetingUrl')}
              <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
            </label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder={t('online.meetingUrlPlaceholder')}
              className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
              style={inputStyle}
            />
          </div>
        ) : (
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
        )}

        {/* Proposed Date */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('proposals.proposedDate')}
            <span className="ml-1 text-text-dark opacity-60">({t('common.optional')})</span>
          </label>
          <input
            type="date"
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
        </div>

        {/* Weather badge */}
        {!isOnline && weatherToShow && weatherToShow.length > 0 && (
          <div className="flex items-center gap-1.5 mb-4">
            {weatherToShow.map((w) => (
              <WeatherBadge key={w.city} weatherCode={w.weatherCode} tempMax={w.tempMax} />
            ))}
          </div>
        )}

        {(!weatherToShow || isOnline) && <div className="mb-4" />}

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {isCreating ? t('proposals.creating') : t('proposals.create')}
        </Button>
      </div>
    </IonModal>
  );
}
