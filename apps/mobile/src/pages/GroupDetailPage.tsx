import { useState } from 'react';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonAlert,
  IonActionSheet,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useParams, useHistory } from 'react-router-dom';
import { Share } from '@capacitor/share';
import {
  useGroup,
  useGroupInvite,
  useRefreshInvite,
  useLeaveGroup,
  useUpdateMemberRole,
  useKickMember,
  useDeleteGroup,
} from '../hooks/useGroups';
import { useGroupSync } from '../hooks/useGroupSync';
import { useScreenView } from '../hooks/useAnalytics';
import { useAuthStore } from '../stores/auth';
import { motion } from 'framer-motion';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { WeatherWidget } from '../components/WeatherWidget';
import { useGroupWeather } from '../hooks/useWeather';
import { useAnalytics } from '../hooks/useAnalytics';
import { useGroupCities, useAddCity, useRemoveCity } from '../hooks/useGroupCities';
import { searchCities, type GeocodingResult } from '../services/weather';
import { MEMBER_COLORS, MEMBER_GRADIENTS, MEMBER_GLOWS } from '../lib/constants';

function formatCode(code: string): string {
  return code.slice(0, 4) + '-' + code.slice(4);
}

export default function GroupDetailPage() {
  useScreenView('GroupDetail');
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: group, isLoading } = useGroup(id);
  useGroupSync(id);
  const { data: invite } = useGroupInvite(id);
  const refreshInvite = useRefreshInvite();
  const leaveGroup = useLeaveGroup();
  const updateRole = useUpdateMemberRole(id);
  const kickMember = useKickMember(id);
  const deleteGroup = useDeleteGroup();

  const { track } = useAnalytics();
  const [copied, setCopied] = useState(false);
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);
  const [regeneratedFeedback, setRegeneratedFeedback] = useState(false);
  const [actionMember, setActionMember] = useState<{
    userId: string;
    name: string;
    role: string;
  } | null>(null);
  const [showDeleteGroupAlert, setShowDeleteGroupAlert] = useState(false);

  // Weather & Cities
  const { data: cities } = useGroupCities(id);
  const { data: weather } = useGroupWeather(id);
  const addCity = useAddCity(id);
  const removeCity = useRemoveCity(id);
  const [citySearch, setCitySearch] = useState('');
  const [cityResults, setCityResults] = useState<GeocodingResult[]>([]);
  const [showCitySearch, setShowCitySearch] = useState(false);

  const handleCopy = async () => {
    if (!invite?.inviteCode) return;
    await navigator.clipboard.writeText(invite.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!invite?.inviteUrl || !group) return;
    try {
      await Share.share({
        title: group.name,
        text: t('group.shareMessage'),
        url: invite.inviteUrl,
        dialogTitle: t('group.shareMessage'),
      });
      track('share_group');
    } catch {
      // Capacitor Share failed or user cancelled — try Web Share API
      if (navigator.share) {
        try {
          await navigator.share({
            title: group.name,
            text: t('group.shareMessage'),
            url: invite.inviteUrl,
          });
          track('share_group');
          return;
        } catch {
          /* user cancelled */
        }
      }
      // Final fallback: copy to clipboard
      handleCopy();
    }
  };

  const handleCitySearch = async (query: string) => {
    setCitySearch(query);
    if (query.length >= 2) {
      const results = await searchCities(query);
      setCityResults(results);
    } else {
      setCityResults([]);
    }
  };

  const handleAddCity = async (result: GeocodingResult) => {
    await addCity.mutateAsync({
      name: result.name,
      lat: result.latitude,
      lon: result.longitude,
    });
    setCitySearch('');
    setCityResults([]);
    setShowCitySearch(false);
  };

  const handleRegenerate = async () => {
    await refreshInvite.mutateAsync(id);
    setRegeneratedFeedback(true);
    setTimeout(() => setRegeneratedFeedback(false), 2000);
  };

  const handleLeave = async () => {
    await leaveGroup.mutateAsync(id);
    history.replace('/tabs/group');
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'member') => {
    await updateRole.mutateAsync({ userId, role });
  };

  const handleKick = async (userId: string) => {
    await kickMember.mutateAsync(userId);
  };

  const getActionButtons = () => {
    if (!actionMember) return [];
    const buttons: Array<{ text: string; role?: string; handler?: () => void }> = [];

    if (actionMember.role === 'member') {
      buttons.push({
        text: t('group.promoteAdmin'),
        handler: () => handleUpdateRole(actionMember.userId, 'admin'),
      });
      buttons.push({
        text: t('group.kickMember'),
        role: 'destructive',
        handler: () => handleKick(actionMember.userId),
      });
    } else if (actionMember.role === 'admin') {
      buttons.push({
        text: t('group.demoteAdmin'),
        handler: () => handleUpdateRole(actionMember.userId, 'member'),
      });
    }

    buttons.push({ text: t('group.cancel'), role: 'cancel' });
    return buttons;
  };

  const handleDeleteGroup = async () => {
    await deleteGroup.mutateAsync(id);
    history.replace('/tabs/group');
  };

  if (isLoading) {
    return (
      <IonPage>
        <IonContent>
          <div className="flex items-center justify-center h-full">
            <IonSpinner name="crescent" className="text-primary w-8 h-8" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const isAdmin =
    group?.members.some((m) => m.userId === currentUserId && m.role === 'admin') ?? false;

  if (!group) return null;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/group" text="" />
          </IonButtons>
          <IonTitle>
            {group.emoji} {group.name}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4">
          {/* Members */}
          <section className="mb-6">
            <h3 className="text-xs font-semibold text-text-dark uppercase tracking-wider mb-3">
              {t('group.members')} ({group.members.length})
            </h3>
            <div className="flex flex-col gap-2">
              {group.members.map((member, i) => (
                <motion.div
                  key={member.userId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                >
                  <div className="flex items-center gap-3 bg-bg-card border border-subtle rounded-btn px-4 py-3">
                    <Avatar
                      name={member.user.name}
                      color={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                      size={36}
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm text-text truncate">{member.user.name}</span>
                      {member.userId === group.createdById && (
                        <Badge color="#F59E0B">{t('group.creator')}</Badge>
                      )}
                      {member.role === 'admin' && member.userId !== group.createdById && (
                        <Badge color="#60A5FA">{t('group.admin')}</Badge>
                      )}
                      {member.userId === currentUserId && (
                        <span className="text-xs text-text-muted">{t('group.memberYou')}</span>
                      )}
                    </div>
                    {isAdmin &&
                      member.userId !== currentUserId &&
                      member.userId !== group.createdById && (
                        <button
                          onClick={() =>
                            setActionMember({
                              userId: member.userId,
                              name: member.user.name,
                              role: member.role,
                            })
                          }
                          className="text-text-dark hover:text-text text-lg px-1 border-none bg-transparent shrink-0"
                        >
                          &#x22EF;
                        </button>
                      )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Weather & Cities */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-text-dark uppercase tracking-wider">
                {t('weather.title')}
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setShowCitySearch(!showCitySearch)}
                  className="text-[11px] font-semibold text-primary border-none bg-transparent"
                >
                  + {t('weather.addCity')}
                </button>
              )}
            </div>

            {/* City search */}
            {showCitySearch && (
              <div className="mb-3">
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => handleCitySearch(e.target.value)}
                  placeholder={t('weather.searchCity')}
                  className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark mb-1"
                  style={{
                    background: 'var(--app-bg-hover)',
                    border: '1px solid var(--app-border-strong)',
                  }}
                />
                {cityResults.length > 0 && (
                  <div
                    className="rounded-[10px] overflow-hidden"
                    style={{
                      background: 'var(--app-bg-card)',
                      border: '1px solid var(--app-border)',
                    }}
                  >
                    {cityResults.map((r, i) => (
                      <button
                        key={`${r.name}-${r.latitude}-${i}`}
                        onClick={() => handleAddCity(r)}
                        className="w-full text-left px-3 py-2 text-sm text-text border-none hover:bg-bg-hover"
                        style={{
                          borderBottom:
                            i < cityResults.length - 1 ? '1px solid var(--app-border)' : 'none',
                          background: 'transparent',
                        }}
                      >
                        {r.name}
                        {r.admin1 ? `, ${r.admin1}` : ''} — {r.country}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* City list */}
            {cities && cities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {cities.map((city) => (
                  <span
                    key={city.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-text-muted"
                    style={{
                      background: 'var(--app-bg-card)',
                      border: '1px solid var(--app-border)',
                    }}
                  >
                    📍 {city.name}
                    {isAdmin && (
                      <button
                        onClick={() => removeCity.mutate(city.id)}
                        className="text-text-dark hover:text-danger ml-0.5 border-none bg-transparent text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Weather data */}
            {weather && weather.length > 0 && <WeatherWidget weather={weather} />}
          </section>

          {/* Invite */}
          <section className="mb-6">
            <h3 className="text-xs font-semibold text-text-dark uppercase tracking-wider mb-3">
              {t('group.inviteFriends')}
            </h3>
            <div className="bg-bg-card border border-subtle rounded-btn p-4">
              <p className="text-xs text-text-muted mb-2">{t('group.inviteCode')}</p>
              <p className="text-2xl font-mono font-bold text-text tracking-widest mb-4">
                {invite ? formatCode(invite.inviteCode) : '····-····'}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCopy} className="flex-1">
                  {copied ? t('group.codeCopied') : t('group.copyCode')}
                </Button>
                <Button variant="secondary" onClick={handleShare} className="flex-1">
                  {t('group.share')}
                </Button>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowRegenerateAlert(true)}
                  disabled={refreshInvite.isPending}
                  className="w-full mt-3 text-xs text-text-muted hover:text-text transition-colors py-2"
                >
                  {regeneratedFeedback
                    ? t('group.codeRegenerated')
                    : refreshInvite.isPending
                      ? t('group.regenerating')
                      : t('group.regenerateCode')}
                </button>
              )}
            </div>
          </section>

          {/* Leave */}
          <section className="mb-4">
            <button
              type="button"
              onClick={() => setShowLeaveAlert(true)}
              disabled={leaveGroup.isPending}
              className="w-full bg-danger/10 border border-danger/20 rounded-btn px-4 py-3.5 text-sm text-danger font-semibold"
            >
              {leaveGroup.isPending ? t('group.leaving') : t('group.leaveGroup')}
            </button>
          </section>

          {/* Delete group (admin only) */}
          {isAdmin && (
            <section className="mb-8">
              <button
                type="button"
                onClick={() => setShowDeleteGroupAlert(true)}
                className="w-full bg-danger/5 border border-danger/10 rounded-btn px-4 py-3.5 text-sm text-danger/70 font-semibold"
              >
                {t('group.deleteGroup')}
              </button>
            </section>
          )}

          {/* Alerts */}
          <IonAlert
            isOpen={showLeaveAlert}
            onDidDismiss={() => setShowLeaveAlert(false)}
            header={t('group.leaveTitle')}
            message={t('group.leaveMessage')}
            buttons={[
              { text: t('group.cancel'), role: 'cancel' },
              { text: t('group.leaveGroup'), role: 'destructive', handler: handleLeave },
            ]}
          />
          <IonAlert
            isOpen={showRegenerateAlert}
            onDidDismiss={() => setShowRegenerateAlert(false)}
            header={t('group.regenerateTitle')}
            message={t('group.regenerateMessage')}
            buttons={[
              { text: t('group.cancel'), role: 'cancel' },
              { text: t('group.regenerateCode'), handler: handleRegenerate },
            ]}
          />
          <IonActionSheet
            isOpen={actionMember !== null}
            onDidDismiss={() => setActionMember(null)}
            header={actionMember?.name}
            buttons={getActionButtons()}
          />
          <IonAlert
            isOpen={showDeleteGroupAlert}
            onDidDismiss={() => setShowDeleteGroupAlert(false)}
            header={t('group.deleteConfirm')}
            message={t('group.deleteMessage')}
            buttons={[
              { text: t('group.cancel'), role: 'cancel' },
              { text: t('group.deleteGroup'), role: 'destructive', handler: handleDeleteGroup },
            ]}
          />
        </div>
      </IonContent>
    </IonPage>
  );
}
