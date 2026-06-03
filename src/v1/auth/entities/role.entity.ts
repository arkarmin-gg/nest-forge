import { Entity, Column, OneToMany } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { Admin } from 'src/v1/admin/entities/admin.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  // Lower rank = higher privilege (1 = superadmin). Default 99 = lowest privilege.
  @Column({ type: 'int', default: 99 })
  rank!: number;

  @OneToMany(() => Admin, (admin) => admin.role)
  admins!: Admin[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions!: RolePermission[];
}
