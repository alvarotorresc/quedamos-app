import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GroupMember } from '../services/groups';
import { Avatar } from '../ui';
import { buildMemberColorMap } from '../lib/member-colors';
import { aroArc, slotCenter } from '../lib/aro-geometry';

interface GroupRingProps {
  members: GroupMember[];
  emoji: string;
  size?: number;
}

const AVATAR = 30;

export function GroupRing({ members, emoji, size = 168 }: GroupRingProps) {
  const { t } = useTranslation();
  const colorMap = useMemo(() => buildMemberColorMap(members), [members]);
  const ordered = useMemo(
    () => [...members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.userId.localeCompare(b.userId)),
    [members],
  );
  const n = ordered.length;
  const r = size / 2 - AVATAR / 2 - 4;
  const center = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="absolute inset-0" aria-hidden="true">
        {ordered.map((m, i) => {
          const { dasharray, rotate } = aroArc(n, i, r, { strokeWidth: 5 });
          return (
            <circle key={m.userId} cx={center} cy={center} r={r}
              stroke={colorMap.get(m.userId)} strokeWidth={5} strokeLinecap="round"
              strokeDasharray={dasharray} transform={`rotate(${rotate.toFixed(2)} ${center} ${center})`} />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[32px] leading-none">{emoji}</span>
        <span className="font-mono text-[10px] text-text-muted">{t('group.memberCount', { count: n })}</span>
      </div>
      {ordered.map((m, i) => {
        const p = slotCenter(n, i, r);
        return (
          <div key={m.userId} style={{ position: 'absolute', left: center + p.x - AVATAR / 2, top: center + p.y - AVATAR / 2 }}>
            <Avatar name={m.user.name} color={colorMap.get(m.userId) ?? '#60A5FA'} size={AVATAR}
              className="border-[3px] border-bg box-border" />
          </div>
        );
      })}
    </div>
  );
}
