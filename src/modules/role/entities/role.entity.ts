import { SoftDeletableEntity } from 'src/common/entities';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('roles')
@Index('UQ_roles_name_active', ['name'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Role extends SoftDeletableEntity {
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
