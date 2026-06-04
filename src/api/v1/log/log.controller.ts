import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ResolvePresignedUrls } from 'src/common/decorators/presigned-urls.decorator';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/auth';
import { ActivityLogService, AuditLogService } from 'src/modules/log';
import { FilterActivityLogDto } from 'src/modules/log/dto/filter-activity-log.dto';
import { FilterAuditLogDto } from 'src/modules/log/dto/filter-audit-log.dto';

@Controller({ path: '', version: '1' })
@UseGuards(PermissionsGuard)
export class ActivityLogController {
  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('activity-logs')
  @ResolvePresignedUrls('user.profileImageUrl')
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ACTIVITY_LOGS, permission: 'read' },
  )
  async findAllUserLogs(@Query() filterDto: FilterActivityLogDto) {
    return this.activityLogService.findAll(filterDto);
  }

  @Get('audit-logs')
  @ResolvePresignedUrls('admin.profileImageUrl')
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.AUDIT_LOGS, permission: 'read' },
  )
  async findAllAuditLogs(@Query() filterDto: FilterAuditLogDto) {
    return this.auditLogService.findAll(filterDto);
  }
}
