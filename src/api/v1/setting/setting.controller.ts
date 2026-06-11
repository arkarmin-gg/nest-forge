import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RequirePermissions } from 'src/modules/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/modules/auth/entities/permission.entity';
import { PermissionsGuard } from 'src/modules/auth/guards/permissions.guard';
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
