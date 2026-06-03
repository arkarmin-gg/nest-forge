import { Entity, Column, ManyToOne, JoinColumn, Relation } from 'typeorm';
import { User } from 'src/v1/user/entities/user.entity';
import { Admin } from 'src/v1/admin/entities/admin.entity';
import { AuditEntity } from 'src/common/entities/audit.entity';

export enum OtpStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  USED = 'USED',
}

export enum OtpPurpose {
  TWO_FACTOR = 'TWO_FACTOR',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

@Entity('otp_records')
export class OtpRecord extends AuditEntity {
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, (user) => user.otpRecords)
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({ type: 'uuid', nullable: true })
  adminId!: string | null;

  @ManyToOne(() => Admin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adminId' })
  admin!: Admin;

  @Column({ type: 'enum', enum: OtpStatus, default: OtpStatus.PENDING })
  status!: OtpStatus;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose!: OtpPurpose;

  @Column()
  code!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  requestId!: string | null;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ default: 3 })
  maxAttempts!: number;
}
