import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

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

  private getKey(
    header: jwt.JwtHeader,
    callback: (err: Error | null, key?: string) => void,
  ) {
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

      dbUser = await this.prisma.user.create({
        data: {
          id: payload.sub,
          email,
          name,
          avatarEmoji,
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
