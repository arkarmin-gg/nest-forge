import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { LogAction, LogActivity } from 'src/modules/log/api';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/role/api';
import { CreateSMTPDto, SettingService } from 'src/modules/setting/api';

@Controller({ path: 'admin/settings', version: '1' })
@UseGuards(PermissionsGuard)
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Put('smtp')
  @LogActivity({
    action: LogAction.UPDATE,
    description: 'Admin updated SMTP settings',
    resourceType: 'Setting',
  })
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
