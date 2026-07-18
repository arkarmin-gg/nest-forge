import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Request } from 'express';
import { buildRequestContext, resolveSortField } from 'src/common/utils';
import {
  diffAuditValues,
  LogAction,
  LogQueueService,
  LogStatus,
} from 'src/modules/log/public-api';
import { In } from 'typeorm';
import { CreateRoleDto } from '../dto/create-role.dto';
import { FilterRoleDto } from '../dto/filter-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Role } from '../entities/role.entity';

const VALID_SORT_FIELDS: (keyof Role)[] = ['createdAt'];

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly logQueueService: LogQueueService,
  ) {}

  async findAll(
    filter: FilterRoleDto,
  ): Promise<{ items: Role[]; total: number }> {
    const { getAll, limit, page, search } = filter;
    const skip = (page - 1) * limit;

    const orderField = resolveSortField(
      filter.sortBy,
      VALID_SORT_FIELDS,
      'createdAt',
    );

    const qb = this.txHost.tx
      .getRepository(Role)
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.rolePermissions', 'rolePermissions')
      .leftJoinAndSelect('rolePermissions.permission', 'permission')
      .leftJoinAndSelect('permission.module', 'module')
      .orderBy(`role.${orderField}`, filter.sortOrder ?? 'DESC');

    if (!getAll) {
      qb.skip(skip).take(limit);
    }

    if (search) {
      qb.andWhere('(role.name ILIKE :term OR role.description ILIKE :term)', {
        term: `%${search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.txHost.tx
      .getRepository(Permission)
      .createQueryBuilder('permission')
      .leftJoinAndSelect('permission.module', 'module')
      .leftJoinAndSelect('module.parent', 'parent')
      .leftJoinAndSelect('module.children', 'children')
      .leftJoinAndSelect('children.permissions', 'childrenOfChildren')
      .orderBy('module.name', 'ASC')
      .addOrderBy('permission.action', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Role | null> {
    return this.txHost.tx.getRepository(Role).findOne({
      where: { id },
      relations: [
        'rolePermissions',
        'rolePermissions.permission',
        'rolePermissions.permission.module',
      ],
    });
  }

  async findOneOrFail(id: string): Promise<Role> {
    const role = await this.findOne(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  /**
   * Public entrypoint for role creation. The audit-log enqueue happens here,
   * outside the `@Transactional()` boundary of `createInTransaction`, so it
   * only fires once the transaction has actually committed (this method's
   * await only resolves after commit succeeds).
   */
  async create(
    createRoleDto: CreateRoleDto,
    adminId: string,
    request: Request,
  ): Promise<Role | null> {
    try {
      const role = await this.createInTransaction(createRoleDto);

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.CREATE,
        description: 'Admin created a role',
        entityName: 'Role',
        entityId: role?.id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return role;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.CREATE,
        description: 'Role creation failed',
        entityName: 'Role',
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async createOrFail(
    createRoleDto: CreateRoleDto,
    adminId: string,
    request: Request,
  ): Promise<Role> {
    const role = await this.create(createRoleDto, adminId, request);
    if (!role) {
      throw new NotFoundException('Role creation failed');
    }
    return role;
  }

  @Transactional()
  private async createInTransaction(
    createRoleDto: CreateRoleDto,
  ): Promise<Role | null> {
    const existingRole = await this.txHost.tx.getRepository(Role).findOne({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      this.logger.warn(`Role with name '${createRoleDto.name}' already exists`);
      throw new ConflictException(
        `Role with name '${createRoleDto.name}' already exists`,
      );
    }

    await this.validatePermissionIds(createRoleDto.permissionIds);

    const role = this.txHost.tx.create(Role, {
      name: createRoleDto.name,
      description: createRoleDto.description,
      ...(createRoleDto.rank !== undefined && { rank: createRoleDto.rank }),
    });
    const savedRole = await this.txHost.tx.save(role);

    if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
      await this.assignPermissionsToRole(
        savedRole.id,
        createRoleDto.permissionIds,
      );
    }

    this.logger.log(`Role created with ID: ${savedRole.id}`);
    return this.txHost.tx.findOne(Role, {
      where: { id: savedRole.id },
      relations: [
        'rolePermissions',
        'rolePermissions.permission',
        'rolePermissions.permission.module',
      ],
    });
  }

  /**
   * Public entrypoint for role updates — same commit-before-enqueue guarantee
   * as `create` above.
   */
  async update(
    id: string,
    updateRoleDto: UpdateRoleDto,
    adminId: string,
    request: Request,
  ): Promise<Role | null> {
    try {
      const result = await this.updateInTransaction(id, updateRoleDto);

      if (!result) {
        return null;
      }

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'Admin updated a role',
        entityName: 'Role',
        entityId: id,
        oldValue: result.oldValue,
        newValue: result.newValue,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return result.updatedRole;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'Role update failed',
        entityName: 'Role',
        entityId: id,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async updateOrFail(
    id: string,
    updateRoleDto: UpdateRoleDto,
    adminId: string,
    request: Request,
  ): Promise<Role> {
    const role = await this.update(id, updateRoleDto, adminId, request);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  @Transactional()
  private async updateInTransaction(
    id: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<{
    updatedRole: Role;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
  } | null> {
    const role = await this.findOne(id);

    if (!role) {
      return null;
    }

    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.txHost.tx.getRepository(Role).findOne({
        where: { name: updateRoleDto.name },
      });

      if (existingRole) {
        this.logger.warn(
          `Role with name '${updateRoleDto.name}' already exists`,
        );
        throw new ConflictException(
          `Role with name '${updateRoleDto.name}' already exists`,
        );
      }
    }

    if (updateRoleDto.permissionIds) {
      await this.validatePermissionIds(updateRoleDto.permissionIds);
    }

    if (
      updateRoleDto.name ||
      updateRoleDto.description ||
      updateRoleDto.rank !== undefined
    ) {
      await this.txHost.tx.update(Role, id, {
        name: updateRoleDto.name,
        description: updateRoleDto.description,
        ...(updateRoleDto.rank !== undefined && { rank: updateRoleDto.rank }),
      });
    }

    if (updateRoleDto.permissionIds !== undefined) {
      await this.txHost.tx.delete(RolePermission, { roleId: id });

      if (updateRoleDto.permissionIds.length > 0) {
        await this.assignPermissionsToRole(id, updateRoleDto.permissionIds);
      }
    }

    this.logger.log(`Role updated with ID: ${id}`);
    const updatedRole = await this.txHost.tx.findOne(Role, {
      where: { id },
      relations: [
        'rolePermissions',
        'rolePermissions.permission',
        'rolePermissions.permission.module',
      ],
    });

    if (!updatedRole) {
      return null;
    }

    const trackedFields = Object.keys(updateRoleDto).filter(
      (k) => k !== 'permissionIds',
    );
    const { oldValue, newValue } = diffAuditValues(
      role,
      updatedRole,
      trackedFields,
    );

    return { updatedRole, oldValue, newValue };
  }

  async remove(
    id: string,
    adminId: string,
    request: Request,
  ): Promise<boolean> {
    try {
      const role = await this.findOne(id);

      if (!role) {
        return false;
      }

      await this.txHost.tx.getRepository(Role).softDelete(id);
      this.logger.log(
        `Role with ID '${id}' has been successfully soft deleted`,
      );

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.DELETE,
        description: 'Admin deleted a role',
        entityName: 'Role',
        entityId: id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return true;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.DELETE,
        description: 'Role deletion failed',
        entityName: 'Role',
        entityId: id,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  private async validatePermissionIds(permissionIds: string[]): Promise<void> {
    if (!permissionIds || permissionIds.length === 0) {
      return;
    }

    const existingPermissions = await this.txHost.tx
      .getRepository(Permission)
      .findBy({
        id: In(permissionIds),
      });

    if (existingPermissions.length !== permissionIds.length) {
      const existingIds = existingPermissions.map((p) => p.id);
      const invalidIds = permissionIds.filter(
        (id) => !existingIds.includes(id),
      );
      this.logger.warn(`Invalid permission IDs: ${invalidIds.join(', ')}`);
      throw new BadRequestException(
        `Invalid permission IDs: ${invalidIds.join(', ')}`,
      );
    }
  }

  private async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    const rolePermissions = permissionIds.map((permissionId) =>
      this.txHost.tx.create(RolePermission, { roleId, permissionId }),
    );
    await this.txHost.tx.save(RolePermission, rolePermissions);
  }
}
