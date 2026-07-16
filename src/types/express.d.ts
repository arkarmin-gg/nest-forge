import { AuthenticatedUser } from 'src/modules/auth/interfaces/user.interface';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
