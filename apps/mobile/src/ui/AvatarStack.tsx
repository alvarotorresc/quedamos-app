import { Avatar } from './Avatar';

interface Member {
  name: string;
  color: string;
}

interface AvatarStackProps {
  members: Member[];
  size?: number;
  max?: number;
}

export function AvatarStack({ members, size = 24, max = 6 }: AvatarStackProps) {
  const visible = members.slice(0, max);

  return (
    <div className="flex">
      {visible.map((member, i) => (
        <div
          key={member.name}
          style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }}
        >
          <Avatar name={member.name} color={member.color} size={size} />
        </div>
      ))}
    </div>
  );
}
