import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatarEmoji?: string;
  };
  exp: number;
}

@Injectable()
export class AuthService {
  private jwtSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.jwtSecret = this.configService.getOrThrow('SUPABASE_JWT_SECRET');
  }

  async validateToken(token: string) {
    let payload: SupabaseJwtPayload;

    try {
      payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as SupabaseJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    let dbUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!dbUser) {
      dbUser = await this.prisma.user.create({
        data: {
          id: payload.sub,
          email: payload.email ?? '',
          name: payload.user_metadata?.name ?? 'Usuario',
          avatarEmoji: payload.user_metadata?.avatarEmoji ?? '😊',
        },
      });
    }

    return dbUser;
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async updateProfile(userId: string, data: { name?: string; avatarEmoji?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
