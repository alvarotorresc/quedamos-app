import { useState, useRef, useEffect } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { useGroups, useCreateGroup, useJoinGroup } from '../hooks/useGroups';
import { useAuthStore } from '../stores/auth';
import { useMyColor } from '../hooks/useMyColor';
import { Avatar } from '../ui/Avatar';
import { AvatarStack } from '../ui/AvatarStack';
import { Button } from '../ui/Button';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

type FormMode = 'create' | 'join' | null;

export default function GroupPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const user = useAuthStore((s) => s.user);
  const myColor = useMyColor();
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [groupName, setGroupName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const toggleForm = (mode: FormMode) => {
    setError('');
    setFormMode(formMode === mode ? null : mode);
    setGroupName('');
    setEmoji('');
    setInviteCode('');
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    setError('');
    try {
      const group = await createGroup.mutateAsync({
        name: groupName.trim(),
        emoji: emoji.trim() || undefined,
      });
      setFormMode(null);
      history.push(`/tabs/group/${group.id}`);
    } catch {
      setError(t('group.createError'));
    }
  };

  const handleJoin = async () => {
    const code = inviteCode.replace(/\D/g, '');
    if (code.length !== 8) {
      setError(t('group.invalidCode'));
      return;
    }
    setError('');
    try {
      const group = await joinGroup.mutateAsync(code);
      setFormMode(null);
      history.push(`/tabs/group/${group.id}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (message.includes('Already a member')) {
        setError(t('group.alreadyMember'));
      } else {
        setError(t('group.joinError'));
      }
    }
  };

  const hasGroups = groups && groups.length > 0;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonTitle>{t('group.title')}</IonTitle>
          <div slot="end" className="pr-4">
            <Avatar name={user?.name ?? 'U'} color={myColor} size={32} />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <IonSpinner name="crescent" className="text-primary w-8 h-8" />
            </div>
          ) : !hasGroups && formMode === null ? (
            /* Empty state */
            <div className="text-center py-16">
              <div className="text-5xl mb-4">👥</div>
              <h2 className="text-lg font-bold text-text mb-1">{t('group.noGroup')}</h2>
              <p className="text-sm text-text-muted mb-8">{t('group.noGroupSubtitle')}</p>
              <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
                <Button onClick={() => toggleForm('create')}>{t('group.createGroup')}</Button>
                <Button variant="secondary" onClick={() => toggleForm('join')}>{t('group.joinWithCode')}</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Groups list */}
              {hasGroups && (
                <div className="flex flex-col gap-2 mb-6">
                  {groups.map((group) => {
                    const memberAvatars = group.members.map((m, i) => ({
                      name: m.user.name,
                      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
                    }));

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => history.push(`/tabs/group/${group.id}`)}
                        className="w-full bg-white/[0.025] border border-white/5 rounded-btn p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
                      >
                        <span className="text-2xl">{group.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text truncate">{group.name}</p>
                          <p className="text-xs text-text-muted">
                            {t('group.memberCount', { count: group.members.length })}
                          </p>
                        </div>
                        <AvatarStack members={memberAvatars} size={24} max={4} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={formMode === 'join' ? 'secondary' : 'primary'}
                  onClick={() => toggleForm('create')}
                  className="flex-1"
                >
                  {t('group.createGroup')}
                </Button>
                <Button
                  variant={formMode === 'create' ? 'secondary' : formMode === 'join' ? 'primary' : 'secondary'}
                  onClick={() => toggleForm('join')}
                  className="flex-1"
                >
                  {t('group.joinWithCode')}
                </Button>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-btn p-3 text-danger text-sm mb-4">
                  {error}
                </div>
              )}

              {/* Create form */}
              {formMode === 'create' && (
                <div className="bg-white/[0.025] border border-white/5 rounded-btn p-4 flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">{t('group.groupName')}</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder={t('group.groupNamePlaceholder')}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-sm text-text placeholder-text-dark outline-none focus:border-primary/40"
                      autoFocus
                    />
                  </div>
                  <div className="relative">
                    <label className="text-xs text-text-muted mb-1 block">{t('group.emoji')}</label>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-16 h-12 bg-white/5 border border-white/10 rounded-btn text-2xl flex items-center justify-center hover:border-primary/40 transition-colors"
                    >
                      {emoji || '👥'}
                    </button>
                    {showEmojiPicker && (
                      <div ref={pickerRef} className="absolute z-50 top-full mt-2 left-0">
                        <Picker
                          data={data}
                          onEmojiSelect={(emojiData: { native: string }) => {
                            setEmoji(emojiData.native);
                            setShowEmojiPicker(false);
                          }}
                          theme="dark"
                          previewPosition="none"
                          skinTonePosition="search"
                          maxFrequentRows={1}
                        />
                      </div>
                    )}
                  </div>
                  <Button onClick={handleCreate} disabled={createGroup.isPending || !groupName.trim()}>
                    {createGroup.isPending ? t('group.creating') : t('group.createGroup')}
                  </Button>
                </div>
              )}

              {/* Join form */}
              {formMode === 'join' && (
                <div className="bg-white/[0.025] border border-white/5 rounded-btn p-4 flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">{t('group.inviteCode')}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder={t('group.inviteCodePlaceholder')}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-sm text-text placeholder-text-dark outline-none focus:border-primary/40 text-center font-mono tracking-widest"
                      maxLength={8}
                      autoFocus
                    />
                  </div>
                  <Button onClick={handleJoin} disabled={joinGroup.isPending || inviteCode.replace(/\D/g, '').length !== 8}>
                    {joinGroup.isPending ? t('group.joining') : t('group.joinWithCode')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
