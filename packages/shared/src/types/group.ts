import type { User } from './user.js';

export interface Group {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  joinedAt: Date;
  user?: User;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}

export interface CreateGroupDto {
  name: string;
  emoji?: string;
}

export interface JoinGroupDto {
  inviteCode: string;
}
