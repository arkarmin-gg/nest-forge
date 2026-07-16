import { SoftDeletableEntity } from 'src/common/entities';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Relation,
} from 'typeorm';
import { ModuleEntity } from './module.entity';
import { RolePermission } from './role-permission.entity';
import { ActionType } from '../constants/action-type.enum';

@Entity('permissions')
@Index('UQ_permissions_module_action_active', ['moduleId', 'action'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Permission extends SoftDeletableEntity {
  @Index()
  @Column('uuid')
  moduleId!: string;

  @ManyToOne(() => ModuleEntity, (module) => module.permissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'module_id' })
  module!: Relation<ModuleEntity>;

  @Column({ type: 'varchar' })
  action!: ActionType;

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions!: RolePermission[];
}
