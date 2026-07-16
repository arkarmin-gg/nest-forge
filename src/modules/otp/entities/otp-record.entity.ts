import { Exclude } from 'class-transformer';
import { BaseEntity } from 'src/common/entities';
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
import { OtpPurpose } from '../constants/otp-purpose.enum';
import { OtpStatus } from '../constants/otp-status.enum';

@Entity('otp_records')
@Index(['userId', 'purpose', 'status'])
@Index(['adminId', 'purpose', 'status'])
export class OtpRecord extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, (user) => user.otpRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  adminId!: string | null;

  @ManyToOne(() => Admin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id' })
  admin!: Relation<Admin>;

  @Column({ type: 'varchar', default: OtpStatus.PENDING })
  status!: OtpStatus;

  @Column({ type: 'varchar' })
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
