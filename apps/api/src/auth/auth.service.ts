import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { isPushLanguage, normalizePushLanguage } from '../notifications/push-language';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatarEmoji?: string;
    language?: string;
  };
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwks: JwksClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
    this.jwks = new JwksClient({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 min
    });
  }

  private getKey(header: jwt.JwtHeader, callback: (err: Error | null, key?: string) => void) {
    this.jwks.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err);
        return;
      }
      callback(null, key?.getPublicKey());
    });
  }

  async validateToken(token: string) {
    let payload: SupabaseJwtPayload;

    try {
      payload = await new Promise((resolve, reject) => {
        jwt.verify(
          token,
          (header, cb) => this.getKey(header, cb),
          { algorithms: ['ES256'] },
          (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded as SupabaseJwtPayload);
          },
        );
      });
    } catch (err) {
      this.logger.debug(`Token validation failed: ${err}`);
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    let dbUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!dbUser) {
      const name = (payload.user_metadata?.name ?? 'Usuario').trim().slice(0, 100);
      const email = (payload.email ?? '').trim().slice(0, 255);
      const avatarEmoji = (payload.user_metadata?.avatarEmoji ?? '😊').slice(0, 10);
      const language = normalizePushLanguage(payload.user_metadata?.language);

      try {
        dbUser = await this.prisma.user.create({
          data: {
            id: payload.sub,
            email,
            name,
            avatarEmoji,
            language,
          },
        });
      } catch (error: unknown) {
        // Unique constraint violation — another concurrent request already created the user
        if (error instanceof Object && 'code' in error && error.code === 'P2002') {
          dbUser = await this.prisma.user.findUnique({
            where: { id: payload.sub },
          });
        } else {
          throw error;
        }
      }
    } else {
      // One write for everything the JWT is authoritative about, so a login that changes
      // both the email and the language does not cost two round trips.
      const data: { email?: string; language?: string } = {};

      if (payload.email && dbUser.email !== payload.email) {
        // Sync email when user confirms an email change in Supabase
        const newEmail = payload.email.trim().slice(0, 255);
        if (newEmail.length >= 3 && newEmail.includes('@')) {
          data.email = newEmail;
        } else {
          this.logger.warn(`Skipping email sync — malformed email in JWT for user ${payload.sub}`);
        }
      }

      // Sync the push language when the app switches it (supabase.auth.updateUser).
      // An unsupported value is ignored: better a Spanish push than none.
      const language = payload.user_metadata?.language;
      if (isPushLanguage(language) && dbUser.language !== language) {
        data.language = language;
      }

      if (Object.keys(data).length > 0) {
        dbUser = await this.prisma.user.update({
          where: { id: payload.sub },
          data,
        });
      }
    }

    if (!dbUser) {
      // P2002 retry found nothing (user deleted concurrently) — reject cleanly
      // instead of letting a null user reach request handlers as a 500.
      this.logger.warn(`validateToken: user ${payload.sub} vanished after P2002 retry`);
      throw new UnauthorizedException('User not found');
    }

    return dbUser;
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarEmoji: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(userId: string, data: { name?: string; avatarEmoji?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
