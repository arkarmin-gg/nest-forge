export const EMAIL_NOTIFICATION_QUEUE = 'email-notification';

export enum EmailJobName {
  SEND_FORGOT_PASSWORD_RESET_CODE = 'forgot_password_reset',
}

export const EMAIL_NOTIFICATION_JOB_ATTEMPTS = 3;

export const EMAIL_NOTIFICATION_BACKOFF_DELAY_MS = 2000;
