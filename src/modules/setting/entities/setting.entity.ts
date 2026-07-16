import { SoftDeletableEntity } from 'src/common/entities';
import { Column, Entity, Index } from 'typeorm';

@Entity('settings')
@Index('UQ_settings_key_active', ['key'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Setting extends SoftDeletableEntity {
  @Column({ nullable: false })
  key!: string;

  // Stored as jsonb so values keep their native type (string | number | boolean | object).
  @Column({ type: 'jsonb', default: {} })
  value!: unknown;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
