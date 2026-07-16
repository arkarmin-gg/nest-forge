import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { attachAuditLogMetadata, diffAuditValues } from 'src/modules/log/api';
import { FindManyOptions, ILike, In } from 'typeorm';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Role } from '../entities/role.entity';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
    getAll: boolean = false,
    search?: string,
  ): Promise<{ items: Role[]; total: number }> {
    const skip = (page - 1) * limit;
    const findOptions: FindManyOptions<Role> = {
      order: { createdAt: 'DESC' },
      relations: [
        'rolePermissions',
        'rolePermissions.permission',
        'rolePermissions.permission.module',
      ],
    };

    if (search) {
      findOptions.where = [
        { name: ILike(`%${search}%`) },
        { description: ILike(`%${search}%`) },
      ];
    }

    if (!getAll) {
      findOptions.skip = skip;
      findOptions.take = limit;
    }

    const [items, total] = await this.txHost.tx
      .getRepository(Role)
      .findAndCount(findOptions);
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

  @Transactional()
  async create(createRoleDto: CreateRoleDto): Promise<Role | null> {
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

  @Transactional()
  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role | null> {
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

    if (updatedRole) {
      const trackedFields = Object.keys(updateRoleDto).filter(
        (k) => k !== 'permissionIds',
      );
      attachAuditLogMetadata(
        updatedRole,
        diffAuditValues(role, updatedRole, trackedFields),
      );
    }

    return updatedRole;
  }

  async remove(id: string): Promise<boolean> {
    const role = await this.findOne(id);

    if (!role) {
      return false;
    }

    await this.txHost.tx.getRepository(Role).softDelete(id);
    this.logger.log(`Role with ID '${id}' has been successfully soft deleted`);
    return true;
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
