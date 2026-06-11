import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('settings')
export class Setting extends BaseEntity {
  @Column({ nullable: false, unique: true })
  key!: string;

  // Stored as jsonb so values keep their native type (string | number | boolean | object).
  @Column({ type: 'jsonb', default: {} })
  value!: unknown;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
