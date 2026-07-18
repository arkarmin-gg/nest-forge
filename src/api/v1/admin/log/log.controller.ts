import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ResolvePresignedUrls } from 'src/common/decorators';
import {
  ActivityLogService,
  AuditLogService,
  FilterActivityLogDto,
  FilterAuditLogDto,
} from 'src/modules/log/public-api';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/role/public-api';

@Controller({ path: 'admin', version: '1' })
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
