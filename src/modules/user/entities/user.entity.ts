import { Exclude } from 'class-transformer';
import { SoftDeletableEntity } from 'src/common/entities';
import { hashPasswordIfNeeded } from 'src/common/utils';
import { RefreshToken } from 'src/modules/auth/entities/refresh-token.entity';
import { OtpRecord } from 'src/modules/otp/entities/otp-record.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  OneToMany,
} from 'typeorm';
import { LoginProvider } from '../enums/login-provider.enum';

@Entity('users')
@Index('UQ_users_phone_active', ['phone'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('UQ_users_googleId_active', ['googleId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('UQ_users_appleId_active', ['appleId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class User extends SoftDeletableEntity {
  @Index()
  @Column({ nullable: true })
  email!: string;

  @Index()
  @Column({ nullable: true })
  fullName!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true, select: false })
  @Exclude()
  password!: string;

  @Index()
  @Column({ default: false })
  isBanned!: boolean;

  @Column({ nullable: true })
  profileImageKey!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLogoutAt?: Date;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens?: RefreshToken[];

  @OneToMany(() => OtpRecord, (record) => record.user)
  otpRecords?: OtpRecord[];

  @Column({ type: 'varchar', nullable: true })
  googleId?: string;

  @Column({ type: 'varchar', nullable: true })
  appleId?: string;

  @Column({ type: 'varchar', nullable: true })
  loginProvider?: LoginProvider;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    this.password = await hashPasswordIfNeeded(this.password);
  }
}
