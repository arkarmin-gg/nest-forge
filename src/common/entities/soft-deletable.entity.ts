import { DeleteDateColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class SoftDeletableEntity extends BaseEntity {
  @Index()
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;
}
