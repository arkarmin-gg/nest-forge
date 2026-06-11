import { Exclude } from 'class-transformer';
import { BaseEntity } from 'src/common/entities/base.entity';
import { hashPasswordIfNeeded } from 'src/common/utils/password-hash.util';
import { RefreshToken } from 'src/modules/auth/entities/refresh-token.entity';
import { Role } from 'src/modules/auth/entities/role.entity';
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
export class Admin extends BaseEntity {
  @Index()
  @Column()
  fullName!: string;

  @Column({ nullable: true })
  @Exclude()
  password!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  profileImageUrl!: string;

  @Index()
  @Column()
  roleId!: string;

  @ManyToOne(() => Role, undefined, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.admin)
  refreshTokens!: RefreshToken[];

  @Index()
  @Column({ default: false })
  isBanned!: boolean;

  @Column({ default: false })
  isTwoFactorEnabled!: boolean;

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
