import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleEntity } from '../entities/module.entity';
import { Permission } from '../entities/permission.entity';
import { ActionType } from '../enums/action-type.enum';
import { PermissionModule } from '../enums/permission-module.enum';
import { RolePermission } from '../entities/role-permission.entity';
import { Role } from '../entities/role.entity';

interface RoleConfig {
  name: string;
  description: string;
  rank?: number;
  modules: {
    [module: string]: ActionType[];
  };
}

interface ModuleSeed {
  name: string;
  code: PermissionModule;
  parentId?: string | null;
  children?: {
    name: string;
    code: PermissionModule;
  }[];
}

@Injectable()
export class RoleSeeder {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(ModuleEntity)
    private moduleRepository: Repository<ModuleEntity>,
  ) {}

  private getRoleConfigurations(allModules: string[]): RoleConfig[] {
    const allPermissions = Object.values(ActionType).filter(
      (value) => typeof value === 'string',
    ) as ActionType[];

    const moduleAccess = Object.fromEntries(
      allModules.map((module) => [module, allPermissions]),
    );
    return [
      {
        name: 'Super Admin',
        description: 'Super Administrator role with full access',
        rank: 1,
        modules: moduleAccess,
      },
    ];
  }

  async seed() {
    const modulesToSeed: ModuleSeed[] = [
      {
        name: 'Admin',
        code: PermissionModule.ADMIN,
        children: [
          {
            name: 'Admin List',
            code: PermissionModule.ADMIN_LIST,
          },
          {
            name: 'Admin Role Permissions',
            code: PermissionModule.ADMIN_ROLE_PERMISSIONS,
          },
        ],
      },
      {
        name: 'Setting',
        code: PermissionModule.SETTING,
        children: [
          {
            name: 'SMTP Setting',
            code: PermissionModule.SETTING_SMTP,
          },
        ],
      },
      {
        name: 'Application User',
        code: PermissionModule.APPLICATION_USER,
        children: [
          {
            name: 'Application User List',
            code: PermissionModule.APPLICATION_USER_LIST,
          },
        ],
      },
      {
        name: 'Logs',
        code: PermissionModule.LOGS,
        children: [
          {
            name: 'Activity Logs',
            code: PermissionModule.ACTIVITY_LOGS,
          },
          {
            name: 'Audit Logs',
            code: PermissionModule.AUDIT_LOGS,
          },
        ],
      },
    ];

    const createdModules: ModuleEntity[] = [];

    for (const moduleSeed of modulesToSeed) {
      const moduleEntity = await this.upsertModule(moduleSeed);

      if (moduleSeed.children && moduleSeed.children.length > 0) {
        for (const child of moduleSeed.children) {
          const childModule = await this.upsertModule({
            ...child,
            parentId: moduleEntity.id,
          });

          createdModules.push(childModule);
        }
      }

      createdModules.push(moduleEntity);
    }

    const moduleCodes = createdModules.map((m) => m.code);
    const roleConfigs = this.getRoleConfigurations(moduleCodes);
    const modulePermissions: { [moduleCode: string]: Permission[] } = {};

    for (const moduleEntity of createdModules) {
      modulePermissions[moduleEntity.code] =
        await this.createModulePermissions(moduleEntity);
    }

    for (const roleConfig of roleConfigs) {
      const role = await this.createRole(
        roleConfig.name,
        roleConfig.description,
        roleConfig.rank,
      );

      await this.assignPermissionsToRoleFromConfig(
        role,
        roleConfig.modules,
        modulePermissions,
      );
    }
  }

  private async upsertModule(moduleSeed: ModuleSeed): Promise<ModuleEntity> {
    const parentId = moduleSeed.parentId ?? null;
    const existingModule = await this.moduleRepository.findOne({
      where: { code: moduleSeed.code },
    });

    if (existingModule) {
      const shouldUpdate =
        existingModule.name !== moduleSeed.name ||
        (existingModule.parentId ?? null) !== parentId;

      if (shouldUpdate) {
        existingModule.name = moduleSeed.name;
        existingModule.parentId = parentId ?? undefined;
        return this.moduleRepository.save(existingModule);
      }

      return existingModule;
    }

    return this.moduleRepository.save(
      this.moduleRepository.create({
        name: moduleSeed.name,
        code: moduleSeed.code,
        parentId: parentId ?? undefined,
      }),
    );
  }

  private async createRole(
    name: string,
    description: string,
    rank?: number,
  ): Promise<Role> {
    const existingRole = await this.roleRepository.findOne({ where: { name } });
    if (existingRole) {
      const shouldUpdate =
        existingRole.description !== description ||
        (rank !== undefined && existingRole.rank !== rank);

      if (shouldUpdate) {
        existingRole.description = description;
        if (rank !== undefined) {
          existingRole.rank = rank;
        }
        return this.roleRepository.save(existingRole);
      }

      return existingRole;
    }

    return this.roleRepository.save(
      this.roleRepository.create({
        name,
        description,
        ...(rank !== undefined && { rank }),
      }),
    );
  }

  private async createModulePermissions(
    module: ModuleEntity,
  ): Promise<Permission[]> {
    const permissions: Permission[] = [];
    for (const actionType of Object.values(ActionType)) {
      const existing = await this.permissionRepository.findOne({
        where: { moduleId: module.id, action: actionType },
      });
      if (!existing) {
        const p = this.permissionRepository.create({
          moduleId: module.id,
          action: actionType,
        });
        permissions.push(await this.permissionRepository.save(p));
      } else {
        permissions.push(existing);
      }
    }
    return permissions;
  }

  private async assignPermissionsToRoleFromConfig(
    role: Role,
    moduleConfig: { [module: string]: ActionType[] },
    modulePermissions: { [module: string]: Permission[] },
  ) {
    for (const [module, allowed] of Object.entries(moduleConfig)) {
      const permissions = modulePermissions[module] || [];
      const filtered = permissions.filter((p) => allowed.includes(p.action));
      await this.assignPermissionsToRole(role, filtered);
    }
  }

  private async assignPermissionsToRole(role: Role, permissions: Permission[]) {
    for (const permission of permissions) {
      const exists = await this.rolePermissionRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!exists) {
        await this.rolePermissionRepository.save(
          this.rolePermissionRepository.create({
            roleId: role.id,
            permissionId: permission.id,
          }),
        );
      }
    }
  }
}
