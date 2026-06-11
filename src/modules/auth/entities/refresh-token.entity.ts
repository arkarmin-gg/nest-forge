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

@Entity('refresh_tokens')
@Index(['userId', 'isRevoked'])
@Index(['adminId', 'isRevoked'])
export class RefreshToken extends AuditEntity {
  @Column({ unique: true })
  tokenHash!: string;

  @Index()
  @Column({ nullable: true })
  userId!: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Index()
  @Column({ nullable: true })
  adminId!: string;

  @ManyToOne(() => Admin, (admin) => admin.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'adminId' })
  admin!: Relation<Admin>;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ default: false })
  isRevoked!: boolean;
}
