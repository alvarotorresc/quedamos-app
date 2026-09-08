import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { isPushLanguage, normalizePushLanguage } from '../notifications/push-language';
import { sanitizeTimeSlots, timeSlotsEqual, type TimeSlotPreferences } from '@quedamos/shared';

// La comprobacion corre dentro de la peticion del usuario, asi que espera menos
// que el borrado de cuenta: si Supabase Auth tarda mas que esto, mejor un 503 que
// dejar la peticion colgada.
const SUPABASE_TIMEOUT_MS = 5_000;

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatarEmoji?: string;
    language?: string;
    timeSlots?: unknown;
  };
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwks: JwksClient;
  private fetchFn: typeof fetch;
  private readonly supabaseUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
    this.jwks = new JwksClient({
      jwksUri: `${this.supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 min
    });
    this.fetchFn = fetch;
  }

  /** Allow injecting a custom fetch for testing */
  setFetch(fn: typeof fetch): void {
    this.fetchFn = fn;
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

    // Las franjas las escribe el propio usuario en su `user_metadata`, asi que
    // solo entra lo que sobrevive al saneado; lo demas se ignora igual que un
    // idioma desconocido.
    const timeSlots = sanitizeTimeSlots(payload.user_metadata?.timeSlots);

    if (!dbUser) {
      // Un JWT sigue siendo valido hasta una hora despues de borrar la cuenta.
      // Sin esta comprobacion, la siguiente peticion desde otro movil o otra
      // pestana que aun lo lleve volveria a crear la fila: un fantasma sin
      // usuario en Supabase Auth que ademas deja el email pillado por el
      // UNIQUE de la tabla, y esa persona ya no puede registrarse otra vez.
      await this.assertAuthUserExists(payload.sub);

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
            ...(timeSlots && { timeSlots }),
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
      const data: { email?: string; language?: string; timeSlots?: TimeSlotPreferences } = {};

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

      // Sin franjas validas en el token no se toca la columna: un JWT viejo no es
      // el usuario diciendo "borra las mias", solo un token que no las llevaba.
      if (timeSlots && !timeSlotsEqual(dbUser.timeSlots, timeSlots)) {
        data.timeSlots = timeSlots;
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

  /**
   * Confirms with Supabase Auth that the account behind the token still exists.
   * Only a 404 proves it is gone; a bad service key, an outage or a timeout leave
   * the answer unknown, and an unknown answer never creates a row: the request
   * fails with 503 and the caller can retry.
   *
   * Called only when the row is missing — the usual path never pays for it.
   */
  private async assertAuthUserExists(userId: string): Promise<void> {
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');
    if (!serviceKey) {
      this.logger.error(
        'SUPABASE_SERVICE_KEY is not set: cannot verify accounts against Supabase Auth',
      );
      throw new ServiceUnavailableException(
        'Could not verify the account right now. Please try again.',
      );
    }

    let response: Response;
    try {
      response = await this.fetchFn(
        `${this.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
        },
      );
    } catch (error) {
      this.logger.error(`Supabase Auth lookup failed for user ${userId}`, error);
      throw new ServiceUnavailableException(
        'Could not verify the account right now. Please try again.',
      );
    }

    if (response.status === 404) {
      this.logger.warn(
        `Rejected token for ${userId}: the account no longer exists in Supabase Auth`,
      );
      throw new UnauthorizedException('Invalid token');
    }

    if (!response.ok) {
      // Un 401 aqui es nuestra service key, no la cuenta del usuario.
      this.logger.error(`Supabase Auth lookup returned ${response.status} for user ${userId}`);
      throw new ServiceUnavailableException(
        'Could not verify the account right now. Please try again.',
      );
    }
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
