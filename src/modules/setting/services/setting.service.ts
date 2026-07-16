import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToClass } from 'class-transformer';
import { attachAuditLogMetadata, diffAuditValues } from 'src/modules/log/api';
import { Setting } from '../entities/setting.entity';
import { CreateSMTPDto } from '../dto/create-smtp-setting.dto';
import { SMTPResponseDto } from '../dto/smtp-response.dto';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async createSMTPSettings(
    createSMTPDto: CreateSMTPDto,
  ): Promise<SMTPResponseDto> {
    let oldSettings: Record<string, unknown> = {};
    try {
      oldSettings = { ...(await this.getSMTPSettings()) };
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
      const existingSetting = await this.settingRepository.findOne({
        where: { key: setting.key },
      });

      if (existingSetting) {
        existingSetting.value = setting.value;
        await this.settingRepository.save(existingSetting);
      } else {
        const newSetting = this.settingRepository.create(setting);
        await this.settingRepository.save(newSetting);
      }
    }

    const result = await this.getSMTPSettings();
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

    const diff = diffAuditValues(oldSettings, newSettings, trackedFields);
    return attachAuditLogMetadata(result, diff);
  }

  async getSMTPSettings(): Promise<SMTPResponseDto> {
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
