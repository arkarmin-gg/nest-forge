import type { Admin } from 'src/modules/admin';
import type { User } from 'src/modules/user';

type StrippedAdmin = Omit<Admin, 'password' | 'hashPassword'>;
type StrippedUser = Omit<User, 'password' | 'hashPassword'>;

export type AuthenticatedUser = (StrippedAdmin | StrippedUser) & {
  subjectType?: 'ADMIN' | 'USER';
  role?: StrippedAdmin['role'];
};

export interface RequestWithUser extends Request {
  params: Record<string, string>;
  user: AuthenticatedUser;
}

type AdminJwtPayload = {
  sub: string;
  subjectType: 'ADMIN';
  adminId: string;
  roleId: string;
  iat?: number;
  exp?: number;
};

type UserJwtPayload = {
  sub: string;
  subjectType: 'USER';
  userId: string;
  iat?: number;
  exp?: number;
};

export type JwtPayload = AdminJwtPayload | UserJwtPayload;
