import { Exclude } from 'class-transformer';
import { SoftDeletableEntity } from 'src/common/entities';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';
import { UserDevicePlatform } from '../enums/user-device-platform.enum';
import { User } from './user.entity';

@Entity('user_devices')
@Index('UQ_user_devices_user_device_active', ['userId', 'deviceId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('IDX_user_devices_user_last_seen', ['userId', 'lastSeenAt'])
export class UserDevice extends SoftDeletableEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ type: 'varchar', length: 128 })
  deviceId!: string;

  @Column({ type: 'text', nullable: true, select: false })
  @Exclude()
  fcmToken!: string | null;

  @Column({ type: 'varchar' })
  platform!: UserDevicePlatform;

  @Column({ type: 'varchar', length: 100, nullable: true })
  appVersion!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceModel!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  osVersion!: string | null;

  @Column({ type: 'timestamptz' })
  lastSeenAt!: Date;
}
