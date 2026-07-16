export const LoginProvider = {
  SMS: 'SMS',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
} as const;

export type LoginProvider = (typeof LoginProvider)[keyof typeof LoginProvider];
