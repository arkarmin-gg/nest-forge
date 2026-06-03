import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Delete,
  Query,
  UseGuards,
  NotFoundException,
  Patch,
  HttpCode,
} from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PermissionModule } from '../entities/permission.entity';
import { LogActivity } from 'src/v1/log/decorators/log-activity.decorator';
import { LogAction } from 'src/v1/log/constants/log-action.enum';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { FilterRoleDto } from '../dto/filter-role.dto';

@Controller({ path: 'roles', version: '1' })
@UseGuards(PermissionsGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'read' },
  )
  async findAll(@Query() filterDto: FilterRoleDto) {
    return this.roleService.findAll(
      filterDto.page,
      filterDto.limit,
      filterDto.getAll,
      filterDto.search,
    );
  }

  @Get(':id')
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'read' },
  )
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const role = await this.roleService.findOne(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  @Post()
  @LogActivity({
    action: LogAction.CREATE,
    description: 'Admin created a role',
    resourceType: 'Role',
  })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'create' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'create' },
  )
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.roleService.create(createRoleDto);
    if (!role) throw new NotFoundException('Role creation failed');
    return role;
  }

  @Patch(':id')
  @LogActivity({
    action: LogAction.UPDATE,
    description: 'Admin updated a role',
    resourceType: 'Role',
  })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'update' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'update' },
  )
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    const role = await this.roleService.update(id, updateRoleDto);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  @Delete(':id')
  @HttpCode(200)
  @LogActivity({
    action: LogAction.DELETE,
    description: 'Admin deleted a role',
    resourceType: 'Role',
  })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'delete' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'delete' },
  )
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const deleted = await this.roleService.remove(id);
    if (!deleted) throw new NotFoundException('Role not found');
  }
}
