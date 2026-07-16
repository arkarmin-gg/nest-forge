import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { RegistrationSession } from '../interfaces/registration-session.interface';

@Injectable()
export class RegistrationSessionService {
  private readonly ttlMs = 1800 * 1000; // 30 minutes

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  private getKey(phone: string): string {
    return `registration:${phone}`;
  }

  async create(
    phone: string,
    payload: {
      fullName: string;
      requestId: string;
    },
  ): Promise<RegistrationSession> {
    const session: RegistrationSession = {
      fullName: payload.fullName,
      requestId: payload.requestId,
      otpVerified: false,
    };

    await this.cacheManager.set(this.getKey(phone), session, this.ttlMs);

    return session;
  }

  async get(phone: string): Promise<RegistrationSession> {
    const session = await this.cacheManager.get<RegistrationSession>(
      this.getKey(phone),
    );

    if (!session) {
      throw new UnauthorizedException(
        'Registration session expired or not found. Please request OTP again.',
      );
    }

    return session;
  }

  async getOrNull(phone: string): Promise<RegistrationSession | null> {
    const session = await this.cacheManager.get<RegistrationSession>(
      this.getKey(phone),
    );

    return session ?? null;
  }

  async markVerified(phone: string): Promise<RegistrationSession> {
    const session = await this.get(phone);

    const updatedSession: RegistrationSession = {
      ...session,
      otpVerified: true,
    };

    await this.cacheManager.set(this.getKey(phone), updatedSession, this.ttlMs);

    return updatedSession;
  }

  async delete(phone: string): Promise<void> {
    await this.cacheManager.del(this.getKey(phone));
  }

  validateRequestId(session: RegistrationSession, requestId: string): void {
    if (session.requestId !== requestId) {
      throw new BadRequestException('Invalid OTP request ID.');
    }
  }

  requireOtpVerified(session: RegistrationSession): void {
    if (!session.otpVerified) {
      throw new UnauthorizedException(
        'OTP verification is required before setting password.',
      );
    }
  }
}
