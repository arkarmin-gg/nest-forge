import slugify from 'slugify';
import { SoftDeletableEntity } from 'src/common/entities';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Permission } from './permission.entity';

@Entity('modules')
@Index('UQ_modules_code_active', ['code'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class ModuleEntity extends SoftDeletableEntity {
  @Column()
  name!: string;

  @Column()
  code!: string;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => ModuleEntity, (module) => module.children, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: ModuleEntity;

  @OneToMany(() => ModuleEntity, (module) => module.parent)
  children!: ModuleEntity[];

  @OneToMany(() => Permission, (permission) => permission.module)
  permissions!: Permission[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeCode() {
    if (this.name && !this.code) {
      this.code = slugify(this.name, {
        lower: true,
        strict: true,
        replacement: '_',
        trim: true,
      }).toUpperCase();
    }
  }
}
