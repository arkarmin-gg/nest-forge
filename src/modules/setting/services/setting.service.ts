import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Request } from 'express';
import { plainToClass } from 'class-transformer';
import { buildRequestContext } from 'src/common/utils';
import {
  diffAuditValues,
  LogAction,
  LogQueueService,
  LogStatus,
} from 'src/modules/log/public-api';
import { Setting } from '../entities/setting.entity';
import { CreateSMTPDto } from '../dto/create-smtp-setting.dto';
import { SMTPResponseDto } from '../dto/smtp-response.dto';

@Injectable()
export class SettingService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly logQueueService: LogQueueService,
  ) {}

  async createSMTPSettings(
    createSMTPDto: CreateSMTPDto,
    adminId: string,
    request: Request,
  ): Promise<SMTPResponseDto> {
    try {
      const { result, oldValue, newValue } =
        await this.createSMTPSettingsInTransaction(createSMTPDto);

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'Admin updated SMTP settings',
        entityName: 'Setting',
        oldValue,
        newValue,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return result;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'SMTP settings update failed',
        entityName: 'Setting',
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async getSMTPSettings(): Promise<SMTPResponseDto> {
    return this.getSMTPSettingsFromManager();
  }

  @Transactional()
  private async createSMTPSettingsInTransaction(
    createSMTPDto: CreateSMTPDto,
  ): Promise<{
    result: SMTPResponseDto;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
  }> {
    let oldSettings: Record<string, unknown> = {};
    try {
      oldSettings = { ...(await this.getSMTPSettingsFromManager()) };
    } catch {
      // No existing settings — first-time creation, oldValue stays empty
    }

    const smtpSettings = [
      { key: 'smtp_host', value: createSMTPDto.smtpHost },
      { key: 'smtp_port', value: createSMTPDto.smtpPort },
      { key: 'smtp_secure', value: createSMTPDto.smtpSecure },
      { key: 'smtp_username', value: createSMTPDto.smtpUsername || '' },
      { key: 'smtp_password', value: createSMTPDto.smtpPassword || '' },
      { key: 'smtp_from_email', value: createSMTPDto.smtpFromEmail },
      { key: 'smtp_from_name', value: createSMTPDto.smtpFromName },
      { key: 'smtp_enabled', value: createSMTPDto.smtpEnabled },
    ];

    for (const setting of smtpSettings) {
      const existingSetting = await this.txHost.tx.findOne(Setting, {
        where: { key: setting.key },
      });

      if (existingSetting) {
        existingSetting.value = setting.value;
        await this.txHost.tx.save(Setting, existingSetting);
      } else {
        const newSetting = this.txHost.tx.create(Setting, setting);
        await this.txHost.tx.save(Setting, newSetting);
      }
    }

    const result = await this.getSMTPSettingsFromManager();
    const newSettings = { ...result } as Record<string, unknown>;

    const trackedFields = [
      'smtpHost',
      'smtpPort',
      'smtpSecure',
      'smtpUsername',
      'smtpPassword',
      'smtpFromEmail',
      'smtpFromName',
      'smtpEnabled',
    ];

    const { oldValue, newValue } = diffAuditValues(
      oldSettings,
      newSettings,
      trackedFields,
    );

    return { result, oldValue, newValue };
  }

  private async getSMTPSettingsFromManager(): Promise<SMTPResponseDto> {
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

    const settings = await this.txHost.tx.find(Setting, {
      where: smtpKeys.map((key) => ({ key })),
    });

    if (settings.length === 0) {
      throw new NotFoundException('SMTP settings not found');
    }

    const smtpData = {
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
      createdAt: settings[0]?.createdAt,
      updatedAt: settings[0]?.updatedAt,
    };

    return plainToClass(SMTPResponseDto, smtpData);
  }

  private getSettingValue<T = unknown>(
    settings: Setting[],
    key: string,
  ): T | undefined {
    return settings.find((s) => s.key === key)?.value as T | undefined;
  }
}
