import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from '../interfaces/user.interface';
import { AdminAuthService } from '../services/admin-auth.service';
import { UserAuthService } from '../services/user-auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userAuthService: UserAuthService,
    private adminAuthService: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.subjectType === 'ADMIN' && payload.adminId) {
      const admin = await this.adminAuthService.validateAdminById(
        payload.adminId,
      );
      if (!admin) throw new UnauthorizedException('Invalid token');
      const { password: _p, hashPassword: _h, ...rest } = admin;
      return { ...rest, subjectType: 'ADMIN' };
    }

    if (payload.subjectType === 'USER' && payload.userId) {
      const user = await this.userAuthService.validateUserById(payload.userId);
      if (!user) throw new UnauthorizedException('Invalid token');
      const { password: _p, hashPassword: _h, ...rest } = user;
      return { ...rest, subjectType: 'USER' };
    }

    throw new UnauthorizedException('Invalid token');
  }
}
