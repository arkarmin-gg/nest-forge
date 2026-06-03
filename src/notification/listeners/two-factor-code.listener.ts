import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TWO_FACTOR_CODE_REQUESTED,
  TwoFactorCodeRequestedEvent,
} from 'src/v1/auth/events/two-factor-code-requested.event';
import { NotificationService } from '../notification.service';

@Injectable()
export class TwoFactorCodeListener {
  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(TWO_FACTOR_CODE_REQUESTED, { async: true })
  async handleTwoFactorCodeRequested(
    event: TwoFactorCodeRequestedEvent,
  ): Promise<void> {
    await this.notificationService.sendTwoFactorCode({
      email: event.email,
      code: event.code,
      userName: event.userName,
      fromUsername: event.fromUsername,
      expiresIn: event.expiresIn,
    });
  }
}
