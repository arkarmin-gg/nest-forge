import { Entity, Column, OneToMany, Index } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('roles')
@Index('UQ_roles_name_active', ['name'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Role extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  // Lower rank = higher privilege (1 = superadmin). Default 99 = lowest privilege.
  @Column({ type: 'int', default: 99 })
  rank!: number;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions!: RolePermission[];
}
