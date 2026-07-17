import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUBJECT_KEY } from '../constants/subject-key.constant';
import { SubjectType } from '../enums/subject-type.enum';
import type { RequestWithUser } from '../interfaces/user.interface';

// Asserts that the authenticated Subject is of the required type (USER or ADMIN).
// Runs after the global JwtAuthGuard, so request.user (the decoded JWT payload) is
// already populated. Handlers without @RequireSubject() are left untouched.
@Injectable()
export class SubjectGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredSubject = this.reflector.getAllAndOverride<
      SubjectType | undefined
    >(SUBJECT_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredSubject) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (!user || user.subjectType !== requiredSubject) {
      throw new ForbiddenException(
        `Access denied: this endpoint is restricted to ${requiredSubject} subjects`,
      );
    }

    return true;
  }
}
