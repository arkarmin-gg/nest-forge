export const TWO_FACTOR_CODE_REQUESTED = 'two-factor.code.requested';

export class TwoFactorCodeRequestedEvent {
  constructor(
    public readonly email: string,
    public readonly code: string,
    public readonly userName: string,
    public readonly fromUsername: string,
    public readonly expiresIn: number,
  ) {}
}
