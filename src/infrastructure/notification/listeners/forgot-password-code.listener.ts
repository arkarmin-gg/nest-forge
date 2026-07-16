import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  FORGOT_PASSWORD_CODE_REQUESTED,
  ForgotPasswordCodeRequestedEvent,
} from 'src/modules/auth';
import { NotificationService } from '../notification.service';

@Injectable()
export class ForgotPasswordCodeListener {
  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(FORGOT_PASSWORD_CODE_REQUESTED, { async: true })
  async handleForgotPasswordCodeRequested(
    event: ForgotPasswordCodeRequestedEvent,
  ): Promise<void> {
    await this.notificationService.sendForgotPasswordResetCode({
      email: event.email,
      code: event.code,
      userName: event.userName,
      fromUsername: event.fromUsername,
      expiresIn: event.expiresIn,
    });
  }
}
