import {
  Controller,
  UseGuards,
  Put,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PermissionsGuard } from 'src/v1/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/v1/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/v1/auth/entities/permission.entity';
import { LogActivity } from 'src/v1/log/decorators/log-activity.decorator';
import { LogAction } from 'src/v1/log/constants/log-action.enum';
import { SettingService } from '../services/setting.service';
import { CreateSMTPDto } from '../dto/create-smtp-setting.dto';

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
