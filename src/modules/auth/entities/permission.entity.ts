import { BaseEntity } from 'src/common/entities/base.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { ModuleEntity } from './module.entity';
import { RolePermission } from './role-permission.entity';

export enum ActionType {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum PermissionModule {
  ADMIN = 'ADMIN',
  ADMIN_LIST = 'ADMIN_LIST',
  ADMIN_ROLE_PERMISSIONS = 'ADMIN_ROLE_PERMISSIONS',

  SETTING = 'SETTING',
  SETTING_SMTP = 'SETTING_SMTP',

  APPLICATION_USER = 'APPLICATION_USER',
  APPLICATION_USER_LIST = 'APPLICATION_USER_LIST',

  LOGS = 'LOGS',
  ACTIVITY_LOGS = 'ACTIVITY_LOGS',
  AUDIT_LOGS = 'AUDIT_LOGS',
}

@Entity('permissions')
@Index(['moduleId', 'action'], { unique: true })
export class Permission extends BaseEntity {
  @Index()
  @Column('uuid')
  moduleId!: string;

  @ManyToOne(() => ModuleEntity, (module) => module.permissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'moduleId' })
  module!: ModuleEntity;

  @Column({ type: 'varchar' })
  action!: ActionType;

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions!: RolePermission[];
}
