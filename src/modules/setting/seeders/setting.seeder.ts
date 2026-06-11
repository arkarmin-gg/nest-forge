import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../entities/setting.entity';

interface SettingSeed {
  key: string;
  value: unknown;
  description: string;
}

@Injectable()
export class SettingSeeder {
  constructor(
    @InjectRepository(Setting)
    private settingRepository: Repository<Setting>,
    private readonly configService: ConfigService,
  ) {}

  async seed() {
    const smtpSettings: SettingSeed[] = [
      {
        key: 'smtp_host',
        value: 'smtp.gmail.com',
        description: 'SMTP server hostname used for outgoing emails.',
      },
      {
        key: 'smtp_port',
        value: 587,
        description: 'SMTP server port used for outgoing emails.',
      },
      {
        key: 'smtp_secure',
        value: false,
        description: 'Whether SMTP should use a secure TLS connection.',
      },
      {
        key: 'smtp_username',
        value: '',
        description: 'Optional SMTP authentication username.',
      },
      {
        key: 'smtp_password',
        value: '',
        description: 'Optional SMTP authentication password.',
      },
      {
        key: 'smtp_from_email',
        value: 'noreply@example.com',
        description: 'Default sender email address for outgoing emails.',
      },
      {
        key: 'smtp_from_name',
        value: this.configService.get<string>(
          'SMTP_FROM_NAME',
          'NestJS TypeORM API Starter',
        ),
        description: 'Default sender display name for outgoing emails.',
      },
      {
        key: 'smtp_enabled',
        value: true,
        description: 'Whether SMTP delivery is enabled.',
      },
    ];

    for (const settingData of smtpSettings) {
      const existingSetting = await this.settingRepository.findOne({
        where: { key: settingData.key },
      });

      if (!existingSetting) {
        const setting = this.settingRepository.create(settingData);
        await this.settingRepository.save(setting);
        console.log(`Created SMTP setting: ${settingData.key}`);
      } else {
        const shouldUpdate =
          !Object.is(existingSetting.value, settingData.value) ||
          existingSetting.description !== settingData.description;

        if (shouldUpdate) {
          existingSetting.value = settingData.value;
          existingSetting.description = settingData.description;
          await this.settingRepository.save(existingSetting);
          console.log(`Updated SMTP setting: ${settingData.key}`);
        } else {
          console.log(`SMTP setting already exists: ${settingData.key}`);
        }
      }
    }

    console.log('SMTP configuration seeding completed');
  }
}
