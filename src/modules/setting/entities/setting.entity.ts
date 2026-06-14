import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('settings')
@Index('UQ_settings_key_active', ['key'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Setting extends BaseEntity {
  @Column({ nullable: false })
  key!: string;

  // Stored as jsonb so values keep their native type (string | number | boolean | object).
  @Column({ type: 'jsonb', default: {} })
  value!: unknown;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
