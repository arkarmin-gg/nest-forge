import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/auth';
import { LogAction, LogActivity } from 'src/modules/log';
import { CreateSMTPDto } from 'src/modules/setting/dto/create-smtp-setting.dto';
import { SettingService } from 'src/modules/setting/services/setting.service';

@Controller({ path: 'settings', version: '1' })
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Put('smtp')
  @LogActivity({
    action: LogAction.UPDATE,
    description: 'Admin updated SMTP settings',
    resourceType: 'Setting',
  })
  @UseGuards(PermissionsGuard)
  @RequirePermissions(
    { module: PermissionModule.SETTING, permission: 'update' },
    { module: PermissionModule.SETTING_SMTP, permission: 'update' },
  )
  @HttpCode(HttpStatus.OK)
  async createSMTPSettings(@Body() createSMTPDto: CreateSMTPDto) {
    return this.settingService.createSMTPSettings(createSMTPDto);
  }

  @Get('smtp')
  async getSMTPSettings() {
    return this.settingService.getSMTPSettings();
  }
}
