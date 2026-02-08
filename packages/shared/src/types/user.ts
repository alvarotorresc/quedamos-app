export interface User {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  avatarEmoji?: string;
}

export interface UpdateUserDto {
  name?: string;
  avatarEmoji?: string;
}
