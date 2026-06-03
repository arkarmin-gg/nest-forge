import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Admin } from 'src/v1/admin/entities/admin.entity';
import { Repository } from 'typeorm';
import { CHECK_OWNERSHIP_KEY } from '../decorators/check-ownership.decorator';
import { AuthenticatedUser } from '../interfaces/user.interface';

@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const checkOwnership = this.reflector.getAllAndOverride<boolean>(
      CHECK_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!checkOwnership) return true;

    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: Record<string, string>;
    }>();

    const user = request.user;
    const targetId = request.params?.id;

    if (!targetId) return true;

    if (user.subjectType === 'USER') {
      if (user.id !== targetId) {
        throw new ForbiddenException(
          'You do not have permission to access this resource',
        );
      }
      return true;
    }

    if (user.subjectType === 'ADMIN') {
      const requestingRank =
        (user as Admin & { subjectType: 'ADMIN' }).role?.rank ?? 99;

      const targetAdmin = await this.adminRepository.findOne({
        where: { id: targetId },
        relations: ['role'],
      });

      if (!targetAdmin) return true;

      const targetRank = targetAdmin.role?.rank ?? 99;

      if (requestingRank > targetRank) {
        throw new ForbiddenException(
          'You do not have sufficient privileges to modify this admin',
        );
      }

      return true;
    }

    return true;
  }
}
