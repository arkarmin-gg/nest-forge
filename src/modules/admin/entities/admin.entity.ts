import { Exclude } from 'class-transformer';
import { SoftDeletableEntity } from 'src/common/entities';
import { hashPasswordIfNeeded } from 'src/common/utils';
import { RefreshToken } from 'src/modules/auth/entities/refresh-token.entity';
import { Role } from 'src/modules/role/entities/role.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

@Entity('admins')
@Index('UQ_admins_email_active', ['email'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Admin extends SoftDeletableEntity {
  @Index()
  @Column()
  fullName!: string;

  @Column({ nullable: true, select: false })
  @Exclude()
  password!: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  profileImageKey!: string;

  @Index()
  @Column()
  roleId!: string;

  @ManyToOne(() => Role, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.admin)
  refreshTokens!: RefreshToken[];

  @Index()
  @Column({ default: false })
  isBanned!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLogoutAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    this.password = await hashPasswordIfNeeded(this.password);
  }
}
