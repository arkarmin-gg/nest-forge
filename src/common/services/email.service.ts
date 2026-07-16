import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Setting } from 'src/modules/setting/entities/setting.entity';
import { Repository } from 'typeorm';
import { SMTP_CACHE_TTL_MS as SMTP_TTL, isOtpMockEnabled } from '../utils';
import { resetPasswordEmailTemplate } from './email-templates/reset-password.template';

interface SMTPConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpEnabled: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpConfigCache: SMTPConfig | null = null;
  private smtpConfigCachedAt = 0;
  private readonly SMTP_CACHE_TTL_MS = SMTP_TTL;

  constructor(
    @InjectRepository(Setting)
    private settingRepository: Repository<Setting>,
    private readonly configService: ConfigService,
  ) {}

  private async getTransporter() {
    const smtpSettings = await this.getSMTPSettings();

    if (!smtpSettings.smtpEnabled) {
      throw new Error('SMTP is not enabled');
    }

    return nodemailer.createTransport({
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort,
      secure: smtpSettings.smtpSecure,
      auth:
        smtpSettings.smtpUsername && smtpSettings.smtpPassword
          ? {
              user: smtpSettings.smtpUsername,
              pass: smtpSettings.smtpPassword,
            }
          : undefined,
    });
  }

  private async getSMTPSettings(): Promise<SMTPConfig> {
    const now = Date.now();
    if (
      this.smtpConfigCache &&
      now - this.smtpConfigCachedAt < this.SMTP_CACHE_TTL_MS
    ) {
      return this.smtpConfigCache;
    }

    const smtpKeys = [
      'smtp_host',
      'smtp_port',
      'smtp_secure',
      'smtp_username',
      'smtp_password',
      'smtp_from_email',
      'smtp_from_name',
      'smtp_enabled',
    ];

    const settings = await this.settingRepository.find({
      where: smtpKeys.map((key) => ({ key })),
    });

    this.smtpConfigCache = {
      smtpHost: this.getSettingValue<string>(settings, 'smtp_host') ?? '',
      smtpPort: this.getSettingValue<number>(settings, 'smtp_port') ?? 587,
      smtpSecure:
        this.getSettingValue<boolean>(settings, 'smtp_secure') ?? false,
      smtpUsername:
        this.getSettingValue<string>(settings, 'smtp_username') ?? '',
      smtpPassword:
        this.getSettingValue<string>(settings, 'smtp_password') ?? '',
      smtpFromEmail:
        this.getSettingValue<string>(settings, 'smtp_from_email') ?? '',
      smtpFromName:
        this.getSettingValue<string>(settings, 'smtp_from_name') ?? '',
      smtpEnabled:
        this.getSettingValue<boolean>(settings, 'smtp_enabled') ?? false,
    };
    this.smtpConfigCachedAt = now;

    return this.smtpConfigCache;
  }

  invalidateSmtpCache() {
    this.smtpConfigCache = null;
    this.smtpConfigCachedAt = 0;
  }

  private getSettingValue<T = unknown>(
    settings: Setting[],
    key: string,
  ): T | undefined {
    return settings.find((s) => s.key === key)?.value as T | undefined;
  }

  async sendForgotPasswordResetCode({
    code,
    email,
    userName,
    fromUsername,
    expiresIn,
  }: {
    code: string;
    email: string;
    userName: string;
    fromUsername: string;
    expiresIn: number;
  }): Promise<void> {
    if (isOtpMockEnabled(this.configService)) {
      this.logger.log(`Mock password reset code accepted for ${email}`);
      return;
    }

    try {
      const transporter = await this.getTransporter();
      const smtpSettings = await this.getSMTPSettings();

      const mailOptions = {
        from: `"${smtpSettings.smtpFromName}" <${smtpSettings.smtpFromEmail}>`,
        to: email,
        subject: `Password Reset Code - ${fromUsername}`,
        html: resetPasswordEmailTemplate({
          code,
          userName,
          fromUsername,
          expiresIn,
        }),
      };

      await transporter.sendMail(mailOptions);
      this.logger.log(`Password reset code sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset code to ${email}:`,
        error,
      );
      throw new Error('Failed to send password reset email');
    }
  }
}
