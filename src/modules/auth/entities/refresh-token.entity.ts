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

@Entity('refresh_tokens')
@Index(['userId', 'isRevoked'])
@Index(['adminId', 'isRevoked'])
export class RefreshToken extends BaseEntity {
  @Exclude()
  @Column({ type: 'text', select: false })
  tokenHash!: string;

  @Index()
  @Column({ nullable: true })
  userId!: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Index()
  @Column({ nullable: true })
  adminId!: string;

  @ManyToOne(() => Admin, (admin) => admin.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'admin_id' })
  admin!: Relation<Admin>;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ default: false })
  isRevoked!: boolean;
}
