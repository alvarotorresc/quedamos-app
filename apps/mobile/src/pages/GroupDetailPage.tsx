import { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSpinner, IonAlert } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useParams, useHistory } from 'react-router-dom';
import { Share } from '@capacitor/share';
import { useGroup, useGroupInvite, useRefreshInvite, useLeaveGroup } from '../hooks/useGroups';
import { useGroupSync } from '../hooks/useGroupSync';
import { useAuthStore } from '../stores/auth';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

function formatCode(code: string): string {
  return code.slice(0, 4) + '-' + code.slice(4);
}

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: group, isLoading } = useGroup(id);
  useGroupSync(id);
  const { data: invite } = useGroupInvite(id);
  const refreshInvite = useRefreshInvite();
  const leaveGroup = useLeaveGroup();

  const [copied, setCopied] = useState(false);
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);
  const [regeneratedFeedback, setRegeneratedFeedback] = useState(false);

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
    } catch {
      // Capacitor Share failed or user cancelled — try Web Share API
      if (navigator.share) {
        try {
          await navigator.share({
            title: group.name,
            text: t('group.shareMessage'),
            url: invite.inviteUrl,
          });
          return;
        } catch { /* user cancelled */ }
      }
      // Final fallback: copy to clipboard
      handleCopy();
    }
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

  if (!group) return null;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/group" text="" />
          </IonButtons>
          <IonTitle>{group.emoji} {group.name}</IonTitle>
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
              {group.members.map((member, index) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 bg-white/[0.025] border border-white/5 rounded-btn px-4 py-3"
                >
                  <Avatar
                    name={member.user.name}
                    color={MEMBER_COLORS[index % MEMBER_COLORS.length]}
                    size={36}
                  />
                  <span className="text-sm text-text flex-1">{member.user.name}</span>
                  {member.userId === currentUserId && (
                    <span className="text-xs text-text-muted">{t('group.memberYou')}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Invite */}
          <section className="mb-6">
            <h3 className="text-xs font-semibold text-text-dark uppercase tracking-wider mb-3">
              {t('group.inviteFriends')}
            </h3>
            <div className="bg-white/[0.025] border border-white/5 rounded-btn p-4">
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
            </div>
          </section>

          {/* Leave */}
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setShowLeaveAlert(true)}
              disabled={leaveGroup.isPending}
              className="w-full bg-danger/10 border border-danger/20 rounded-btn px-4 py-3.5 text-sm text-danger font-semibold"
            >
              {leaveGroup.isPending ? t('group.leaving') : t('group.leaveGroup')}
            </button>
          </section>

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
        </div>
      </IonContent>
    </IonPage>
  );
}
