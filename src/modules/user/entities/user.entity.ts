import { Exclude } from 'class-transformer';
import { BaseEntity } from 'src/common/entities/base.entity';
import { hashPasswordIfNeeded } from 'src/common/utils/password-hash.util';
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

export const LoginProvider = {
  SMS: 'SMS',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
} as const;

export type LoginProvider = (typeof LoginProvider)[keyof typeof LoginProvider];

export const UserRegistrationStage = {
  OTP_VERIFIED: 'OTP_VERIFIED',
  PASSWORD_SET: 'PASSWORD_SET',
  COMPLETED: 'COMPLETED',
} as const;

export type UserRegistrationStage =
  (typeof UserRegistrationStage)[keyof typeof UserRegistrationStage];

@Entity('users')
export class User extends BaseEntity {
  @Index()
  @Column({ nullable: true })
  email!: string;

  @Index()
  @Column({ nullable: true })
  fullName!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true })
  @Exclude()
  password!: string;

  @Index()
  @Column({ default: false })
  isBanned!: boolean;

  @Column({ nullable: true })
  profileImageUrl!: string;

  @Column({ nullable: true })
  dateOfBirth!: string;

  @Column({ nullable: true })
  gender?: string;

  @Column({ type: 'varchar', nullable: true })
  preferLanguage?: string;

  @Column({
    type: 'enum',
    enum: UserRegistrationStage,
    default: UserRegistrationStage.OTP_VERIFIED,
    nullable: true,
  })
  registrationStage?: UserRegistrationStage;

  @Column({ type: 'varchar', nullable: true })
  fcmToken?: string | null;

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
