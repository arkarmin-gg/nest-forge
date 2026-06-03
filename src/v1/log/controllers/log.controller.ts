import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from '../services/activity-log.service';
import { AuditLogService } from '../services/audit-log.service';
import { FilterActivityLogDto } from '../dto/filter-activity-log.dto';
import { FilterAuditLogDto } from '../dto/filter-audit-log.dto';
import { PermissionsGuard } from 'src/v1/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/v1/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/v1/auth/entities/permission.entity';
import { ResolvePresignedUrls } from 'src/common/decorators/presigned-urls.decorator';

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
