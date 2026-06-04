import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Admin } from '../entities/admin.entity';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { UpdateAdminDto } from '../dto/update-admin.dto';
import { FilterAdminDto } from '../dto/filter-admin.dto';
import { Role } from 'src/modules/auth';
import { FileUploadService } from 'src/common/services/file-upload.service';
import {
  attachAuditLogMetadata,
  diffAuditValues,
} from 'src/modules/log/utils/audit-log-metadata.util';
import {
  parseRangeStart,
  parseRangeEnd,
} from 'src/common/utils/date-time.util';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private fileUploadService: FileUploadService,
  ) {}

  // ─── Admin CRUD operations ────────────────────────────────────────────────

  async create(createAdminDto: CreateAdminDto, file?: Express.Multer.File) {
    const existingEmailAdmin = await this.adminRepository.findOne({
      where: { email: createAdminDto.email },
    });

    if (existingEmailAdmin) {
      throw new ConflictException(
        `Admin with email '${createAdminDto.email}' already exists`,
      );
    }

    const role = await this.roleRepository.findOne({
      where: { id: createAdminDto.roleId },
    });
    if (!role) {
      throw new NotFoundException(
        `Role with ID '${createAdminDto.roleId}' not found`,
      );
    }

    const profileImageUrl = await this.fileUploadService.resolveProfileImageUrl(
      {
        file,
        bodyUrl: createAdminDto.profileImageUrl,
        existingUrl: '',
        s3Path: 'admins/profile',
      },
    );

    const admin = this.adminRepository.create({
      ...createAdminDto,
      profileImageUrl,
    });
    const savedAdmin = await this.adminRepository.save(admin);
    this.logger.log(`Admin created with ID: ${savedAdmin.id}`);

    return savedAdmin;
  }

  async findAll(filter: FilterAdminDto) {
    const { getAll, limit, page } = filter;
    const skip = (page - 1) * limit;

    const qb = this.adminRepository
      .createQueryBuilder('admin')
      .leftJoinAndSelect('admin.role', 'role')
      .orderBy('admin.createdAt', 'DESC');

    if (!getAll) {
      qb.skip(skip).take(limit);
    }

    if (filter.search) {
      qb.andWhere('(admin.fullName ILIKE :term OR admin.email ILIKE :term)', {
        term: `%${filter.search}%`,
      });
    }

    if (filter.roleId) {
      qb.andWhere('admin.roleId = :roleId', { roleId: filter.roleId });
    }

    if (filter.isBanned !== undefined) {
      qb.andWhere('admin.isBanned = :isBanned', { isBanned: filter.isBanned });
    }

    if (filter.startDate) {
      qb.andWhere('admin.createdAt >= :startDate', {
        startDate: parseRangeStart(filter.startDate),
      });
    }

    if (filter.endDate) {
      qb.andWhere('admin.createdAt <= :endDate', {
        endDate: parseRangeEnd(filter.endDate),
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findOne(id: string) {
    const admin = await this.adminRepository.findOne({
      where: { id },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'role.rolePermissions.permission.module',
      ],
    });
    if (!admin) {
      throw new NotFoundException(`Admin with ID '${id}' not found`);
    }

    return admin;
  }

  async update(
    id: string,
    updateAdminDto: UpdateAdminDto,
    file?: Express.Multer.File,
  ) {
    const existingAdmin = await this.adminRepository.findOne({ where: { id } });

    if (!existingAdmin) {
      throw new NotFoundException(`Admin with ID '${id}' not found`);
    }

    // PartialType uses runtime reflection — cast once to access inherited properties
    const dto = updateAdminDto as Partial<CreateAdminDto>;

    if (dto.email && dto.email !== existingAdmin.email) {
      const duplicateEmailAdmin = await this.adminRepository.findOne({
        where: { email: dto.email },
      });
      if (duplicateEmailAdmin) {
        this.logger.warn(`Admin with email '${dto.email}' already exists`);
        throw new ConflictException(
          `Admin with email '${dto.email}' already exists`,
        );
      }
    }

    if (dto.roleId && dto.roleId !== existingAdmin.roleId) {
      const role = await this.roleRepository.findOne({
        where: { id: dto.roleId },
      });
      if (!role) {
        this.logger.warn(`Role with ID '${dto.roleId}' not found`);
        throw new NotFoundException(`Role with ID '${dto.roleId}' not found`);
      }
    }

    const newProfileImageUrl =
      await this.fileUploadService.resolveProfileImageUrl({
        file,
        bodyUrl: dto.profileImageUrl,
        existingUrl: existingAdmin.profileImageUrl || '',
        s3Path: 'admins/profile',
      });

    const updatedAdmin = await this.adminRepository.preload({
      id,
      ...updateAdminDto,
      profileImageUrl: newProfileImageUrl,
    });

    if (!updatedAdmin) {
      this.logger.warn(`Admin with ID '${id}' not found`);
      throw new NotFoundException(`Admin with ID '${id}' not found`);
    }

    const savedAdmin = await this.adminRepository.save(updatedAdmin);

    attachAuditLogMetadata(
      savedAdmin,
      diffAuditValues(existingAdmin, savedAdmin, [
        ...Object.keys(updateAdminDto),
        ...(file ? ['profileImageUrl'] : []),
      ]),
    );

    await this.fileUploadService.replaceProfileImage(
      newProfileImageUrl,
      existingAdmin.profileImageUrl || '',
    );
    this.logger.log(`Admin updated with ID: ${savedAdmin.id}`);

    return savedAdmin;
  }

  async remove(id: string): Promise<void> {
    const existingAdmin = await this.adminRepository.findOne({
      where: { id },
    });
    if (!existingAdmin) {
      throw new NotFoundException(`Admin with ID '${id}' not found`);
    }

    await this.fileUploadService.deleteProfileImage(
      existingAdmin.profileImageUrl || '',
    );

    await this.adminRepository.softRemove(existingAdmin);
    this.logger.log(`Admin with ID '${id}' has been successfully soft deleted`);
  }

  // ─── Auth-oriented methods (consumed by AuthModule) ───────────────────────

  async findByIdNullable(id: string): Promise<Admin | null> {
    return this.adminRepository.findOne({ where: { id } });
  }

  async findByIdWithRoleRelations(id: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { id },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'role.rolePermissions.permission.module',
      ],
    });
  }

  async findByIdWithRole(id: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.adminRepository.findOne({ where: { email } });
  }

  async findByEmailWithRoleRelations(email: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { email },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'role.rolePermissions.permission.module',
      ],
    });
  }

  async saveEntity(admin: Admin): Promise<Admin> {
    return this.adminRepository.save(admin);
  }

  async preloadEntity(data: DeepPartial<Admin>): Promise<Admin | undefined> {
    return this.adminRepository.preload(data);
  }

  async updateFields(id: string, data: Partial<Admin>): Promise<void> {
    await this.adminRepository.update(id, data);
  }
}
