import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { FileUploadService } from 'src/common/services';
import {
  buildRequestContext,
  parseRangeEnd,
  parseRangeStart,
  resolveSortField,
} from 'src/common/utils';
import {
  diffAuditValues,
  LogAction,
  LogQueueService,
  LogStatus,
} from 'src/modules/log/api';
import { RoleService } from 'src/modules/role/api';
import { DeepPartial, Repository } from 'typeorm';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { FilterAdminDto } from '../dto/filter-admin.dto';
import { UpdateAdminDto } from '../dto/update-admin.dto';
import { Admin } from '../entities/admin.entity';

const VALID_SORT_FIELDS: (keyof Admin)[] = ['createdAt'];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly roleService: RoleService,
    private readonly fileUploadService: FileUploadService,
    private readonly logQueueService: LogQueueService,
  ) {}

  // ─── Admin CRUD operations ────────────────────────────────────────────────

  async create(
    createAdminDto: CreateAdminDto,
    file: Express.Multer.File | undefined,
    adminId: string,
    request: Request,
  ): Promise<Admin> {
    try {
      const existingEmailAdmin = await this.adminRepository.findOne({
        where: { email: createAdminDto.email },
      });

      if (existingEmailAdmin) {
        throw new ConflictException(
          `Admin with email '${createAdminDto.email}' already exists`,
        );
      }

      const role = await this.roleService.findOne(createAdminDto.roleId);
      if (!role) {
        throw new NotFoundException(
          `Role with ID '${createAdminDto.roleId}' not found`,
        );
      }

      const profileImageUrl = await this.fileUploadService.resolveUrl({
        file,
        bodyUrl: createAdminDto.profileImageUrl,
        existingUrl: '',
        path: 'admins/profile',
      });

      const admin = this.adminRepository.create({
        ...createAdminDto,
        profileImageKey: profileImageUrl,
      });
      const savedAdmin = await this.adminRepository.save(admin);
      this.logger.log(`Admin created with ID: ${savedAdmin.id}`);

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.CREATE,
        description: 'Admin created another admin',
        entityName: 'Admin',
        entityId: savedAdmin.id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return savedAdmin;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.CREATE,
        description: 'Admin creation failed',
        entityName: 'Admin',
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async findAll(
    filter: FilterAdminDto,
  ): Promise<{ items: Admin[]; total: number }> {
    const { getAll, limit, page } = filter;
    const skip = (page - 1) * limit;

    const orderField = resolveSortField(
      filter.sortBy,
      VALID_SORT_FIELDS,
      'createdAt',
    );

    const qb = this.adminRepository
      .createQueryBuilder('admin')
      .leftJoinAndSelect('admin.role', 'role')
      .orderBy(`admin.${orderField}`, filter.sortOrder ?? 'DESC');

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

  async findOne(id: string): Promise<Admin> {
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
    file: Express.Multer.File | undefined,
    adminId: string,
    request: Request,
  ): Promise<Admin> {
    try {
      const existingAdmin = await this.adminRepository.findOne({
        where: { id },
      });

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
        const role = await this.roleService.findOne(dto.roleId);
        if (!role) {
          this.logger.warn(`Role with ID '${dto.roleId}' not found`);
          throw new NotFoundException(`Role with ID '${dto.roleId}' not found`);
        }
      }

      const newProfileImageUrl = await this.fileUploadService.resolveUrl({
        file,
        bodyUrl: dto.profileImageUrl,
        existingUrl: existingAdmin.profileImageKey || '',
        path: 'admins/profile',
      });

      const updatedAdmin = await this.adminRepository.preload({
        id,
        ...updateAdminDto,
        profileImageKey: newProfileImageUrl,
      });

      if (!updatedAdmin) {
        this.logger.warn(`Admin with ID '${id}' not found`);
        throw new NotFoundException(`Admin with ID '${id}' not found`);
      }

      const savedAdmin = await this.adminRepository.save(updatedAdmin);

      const { oldValue, newValue } = diffAuditValues(
        existingAdmin,
        savedAdmin,
        [...Object.keys(updateAdminDto), ...(file ? ['profileImageUrl'] : [])],
      );

      await this.fileUploadService.replace(
        newProfileImageUrl,
        existingAdmin.profileImageKey || '',
      );
      this.logger.log(`Admin updated with ID: ${savedAdmin.id}`);

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'Admin updated another admin',
        entityName: 'Admin',
        entityId: savedAdmin.id,
        oldValue,
        newValue,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return savedAdmin;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'Admin update failed',
        entityName: 'Admin',
        entityId: id,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async remove(id: string, adminId: string, request: Request): Promise<void> {
    try {
      const existingAdmin = await this.adminRepository.findOne({
        where: { id },
      });
      if (!existingAdmin) {
        throw new NotFoundException(`Admin with ID '${id}' not found`);
      }

      await this.fileUploadService.remove(existingAdmin.profileImageKey || '');

      await this.adminRepository.softRemove(existingAdmin);
      this.logger.log(
        `Admin with ID '${id}' has been successfully soft deleted`,
      );

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.DELETE,
        description: 'Admin deleted another admin',
        entityName: 'Admin',
        entityId: id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.DELETE,
        description: 'Admin deletion failed',
        entityName: 'Admin',
        entityId: id,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
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

  /**
   * Loads an admin by email including the `select: false` password column.
   * For credential validation only — never expose the returned entity directly.
   */
  async findByEmailWithPassword(email: string): Promise<Admin | null> {
    return this.adminRepository
      .createQueryBuilder('admin')
      .addSelect('admin.password')
      .where('admin.email = :email', { email })
      .getOne();
  }

  /**
   * Loads an admin by id including the `select: false` password column.
   * For credential validation only — never expose the returned entity directly.
   */
  async findByIdWithPassword(id: string): Promise<Admin | null> {
    return this.adminRepository
      .createQueryBuilder('admin')
      .addSelect('admin.password')
      .where('admin.id = :id', { id })
      .getOne();
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

  async hasAdminsWithRole(roleId: string): Promise<boolean> {
    const count = await this.adminRepository.count({ where: { roleId } });
    return count > 0;
  }
}
