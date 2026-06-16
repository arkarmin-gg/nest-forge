import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  addDays,
  isExpired,
  nowUtc,
  REFRESH_TOKEN_TTL_DAYS,
} from 'src/common/utils/date-time.util';
import { sha256Hex } from 'src/common/utils/hash.util';
import { AdminService } from 'src/modules/admin/api';
import { UserService } from 'src/modules/user/api';
import { Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { JwtPayload } from '../interfaces/user.interface';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly userService: UserService,
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a refresh token, stores a SHA-256 hash in the database,
   * and returns the plaintext token to the caller.
   * Storing a hash ensures that a database leak does not expose active sessions.
   */
  async generateRefreshToken(
    ownerId: string,
    ownerType: 'user' | 'admin',
  ): Promise<string> {
    const token = this.jwtService.sign(
      { sub: ownerId },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<number>(
          'JWT_REFRESH_EXPIRATION',
          2592000000,
        ),
      },
    );

    const tokenHash = sha256Hex(token);
    const expiresAt = addDays(REFRESH_TOKEN_TTL_DAYS);

    const refreshToken = this.refreshTokenRepository.create({
      tokenHash,
      ...(ownerType === 'user' ? { userId: ownerId } : { adminId: ownerId }),
      expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);
    return token;
  }

  async refreshAccessToken(refreshTokenString: string): Promise<{
    accessToken: string;
    accessTokenExpiresAt: number;
    user: { id: string };
  }> {
    const tokenHash = sha256Hex(refreshTokenString);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash, isRevoked: false },
      relations: [
        'user',
        'admin',
        'admin.role',
        'admin.role.rolePermissions',
        'admin.role.rolePermissions.permission',
        'admin.role.rolePermissions.permission.module',
      ],
    });

    if (!refreshToken) {
      this.logger.warn('Invalid refresh token provided');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (isExpired(refreshToken.expiresAt)) {
      refreshToken.isRevoked = true;
      await this.refreshTokenRepository.save(refreshToken);

      const ownerId = refreshToken.admin?.id ?? refreshToken.user?.id;
      throw new UnauthorizedException(
        ownerId
          ? `Expired refresh token for user with ID '${ownerId}'! Please login again`
          : 'Expired refresh token! Please login again',
      );
    }

    if (!refreshToken.admin && !refreshToken.user) {
      throw new UnauthorizedException('Invalid refresh token owner');
    }

    let payload: JwtPayload;
    let ownerId: string;

    if (refreshToken.admin) {
      payload = {
        sub: refreshToken.admin.id,
        subjectType: 'ADMIN',
        adminId: refreshToken.admin.id,
        roleId: refreshToken.admin.role?.id,
      };
      ownerId = refreshToken.admin.id;
    } else {
      payload = {
        sub: refreshToken.user.id,
        subjectType: 'USER',
        userId: refreshToken.user.id,
      };
      ownerId = refreshToken.user.id;
    }

    const accessToken = this.jwtService.sign(payload);
    this.logger.log(`Token refreshed for ID '${ownerId}'`);

    return {
      accessToken,
      accessTokenExpiresAt: this.configService.get<number>(
        'JWT_EXPIRATION',
        900000,
      ),
      user: { id: ownerId },
    };
  }

  async revokeAllUserTokens(
    userId: string,
    clearFcmToken: boolean = true,
  ): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    const updateData: { lastLogoutAt: Date; fcmToken?: string } = {
      lastLogoutAt: nowUtc(),
    };

    if (clearFcmToken) {
      updateData.fcmToken = '';
    }

    await this.userService.updateFields(userId, updateData);
  }

  async revokeAllAdminTokens(adminId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { adminId, isRevoked: false },
      { isRevoked: true },
    );
    await this.adminService.updateFields(adminId, { lastLogoutAt: nowUtc() });
  }

  @Cron('0 2 * * *')
  async cleanupExpiredRefreshTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .andWhere('(is_revoked = true OR expires_at < NOW())')
      .execute();

    this.logger.log(
      `Refresh token cleanup: deleted ${result.affected ?? 0} revoked/expired records older than 7 days`,
    );
  }

  async revokeToken(refreshTokenString: string): Promise<void> {
    const tokenHash = sha256Hex(refreshTokenString);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (refreshToken) {
      refreshToken.isRevoked = true;
      await this.refreshTokenRepository.save(refreshToken);
    }
  }
}
