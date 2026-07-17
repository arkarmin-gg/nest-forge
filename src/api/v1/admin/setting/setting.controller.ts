import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from 'src/modules/auth';
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
  @RequirePermissions(
    { module: PermissionModule.SETTING, permission: 'update' },
    { module: PermissionModule.SETTING_SMTP, permission: 'update' },
  )
  @HttpCode(HttpStatus.OK)
  async createSMTPSettings(
    @Body() createSMTPDto: CreateSMTPDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.settingService.createSMTPSettings(
      createSMTPDto,
      admin.id,
      request,
    );
  }

  @Get('smtp')
  async getSMTPSettings() {
    return this.settingService.getSMTPSettings();
  }
}
