import type { AuthenticatedUser } from 'src/modules/auth/public-api';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
