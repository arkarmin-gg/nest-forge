export interface SendForgotPasswordResetCodePayload {
  code: string;
  email: string;
  userName: string;
  fromUsername: string;
  expiresIn: number;
}
