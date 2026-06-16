import { Exclude } from 'class-transformer';
import { AuditEntity } from 'src/common/entities/audit.entity';
import { Admin } from 'src/modules/admin/entities/admin.entity';
import { User } from 'src/modules/user/entities/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

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
@Index(['userId', 'purpose', 'status'])
@Index(['adminId', 'purpose', 'status'])
export class OtpRecord extends AuditEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, (user) => user.otpRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  adminId!: string | null;

  @ManyToOne(() => Admin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adminId' })
  admin!: Relation<Admin>;

  @Column({ type: 'enum', enum: OtpStatus, default: OtpStatus.PENDING })
  status!: OtpStatus;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose!: OtpPurpose;

  @Exclude()
  @Column({ select: false })
  codeHash!: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  requestId!: string | null;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ default: 3 })
  maxAttempts!: number;
}
