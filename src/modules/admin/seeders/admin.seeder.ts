import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/modules/role';
import { Repository } from 'typeorm';
import { Admin } from '../entities/admin.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminSeeder {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly configService: ConfigService,
  ) {}

  async seed(): Promise<void> {
    const role = await this.roleRepository.findOne({
      where: { name: 'Super Admin' },
    });

    if (!role) {
      throw new Error('Super Admin role must be seeded before admin seeding');
    }

    const email = this.configService.get<string>(
      'SUPER_ADMIN_EMAIL',
      'admin@example.com',
    );
    const password = this.configService.get<string>(
      'SUPER_ADMIN_PASSWORD',
      'passwordD123!@#',
    );
    const existing = await this.adminRepository.findOne({ where: { email } });
    if (!existing) {
      await this.adminRepository.save(
        this.adminRepository.create({
          email,
          fullName: 'Super Admin',
          roleId: role.id,
          password,
        }),
      );
    }
  }
}
