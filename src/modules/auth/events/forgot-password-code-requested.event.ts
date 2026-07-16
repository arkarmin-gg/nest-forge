export const FORGOT_PASSWORD_CODE_REQUESTED = 'forgot-password.code.requested';

export class ForgotPasswordCodeRequestedEvent {
  constructor(
    public readonly email: string,
    public readonly code: string,
    public readonly userName: string,
    public readonly fromUsername: string,
    public readonly expiresIn: number,
  ) {}
}
