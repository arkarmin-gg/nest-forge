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
} from 'src/modules/log/public-api';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { FilterUserDto } from '../dto/filter-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

const VALID_SORT_FIELDS: (keyof User)[] = ['createdAt'];

interface LogActor {
  id: string;
  subjectType?: 'ADMIN' | 'USER';
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly fileUploadService: FileUploadService,
    private readonly logQueueService: LogQueueService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    file: Express.Multer.File | undefined,
    adminId: string,
    request: Request,
  ): Promise<User> {
    try {
      const existingPhoneUser = await this.userRepository.findOne({
        where: { phone: createUserDto.phone },
      });

      if (existingPhoneUser) {
        throw new ConflictException(
          `User with phone '${createUserDto.phone}' already exists`,
        );
      }

      let profileImageUrl = createUserDto.profileImageUrl || '';

      if (file) {
        const uploadedKey = await this.fileUploadService.upload(
          file,
          'users/profile',
        );
        if (uploadedKey) {
          profileImageUrl = uploadedKey;
        }
      }

      const user = this.userRepository.create({
        ...createUserDto,
        loginProvider: 'SMS',
        profileImageKey: profileImageUrl,
      });
      const savedUser = await this.userRepository.save(user);
      this.logger.log(`User created with ID: ${savedUser.id}`);

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.CREATE,
        description: 'Admin created a user',
        entityName: 'User',
        entityId: savedUser.id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return savedUser;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.CREATE,
        description: 'User creation failed',
        entityName: 'User',
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async findAll(
    filter: FilterUserDto,
  ): Promise<{ items: User[]; total: number }> {
    const { getAll, limit, page } = filter;
    const skip = (page - 1) * limit;

    const orderField = resolveSortField(
      filter.sortBy,
      VALID_SORT_FIELDS,
      'createdAt',
    );

    const qb = this.userRepository
      .createQueryBuilder('user')
      .orderBy(`user.${orderField}`, filter.sortOrder ?? 'DESC');

    if (!getAll) {
      qb.skip(skip).take(limit);
    }

    if (filter.search) {
      qb.andWhere('(user.fullName ILIKE :term OR user.email ILIKE :term)', {
        term: `%${filter.search}%`,
      });
    }

    if (filter.isBanned !== undefined) {
      qb.andWhere('user.isBanned = :isBanned', { isBanned: filter.isBanned });
    }

    if (filter.startDate) {
      qb.andWhere('user.createdAt >= :startDate', {
        startDate: parseRangeStart(filter.startDate),
      });
    }

    if (filter.endDate) {
      qb.andWhere('user.createdAt <= :endDate', {
        endDate: parseRangeEnd(filter.endDate),
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  /**
   * Shared by the admin zone (admin editing another user — audit log) and the
   * app zone (a user editing their own profile — activity log). `actor`
   * carries whichever subject made the request so the right table is written.
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    file: Express.Multer.File | undefined,
    actor: LogActor,
    request: Request,
  ): Promise<User> {
    try {
      const existingUser = await this.userRepository.findOne({
        where: { id },
      });

      if (!existingUser) {
        throw new NotFoundException(`User with ID '${id}' not found`);
      }

      // PartialType uses runtime reflection — cast once to access inherited properties
      const dto = updateUserDto;

      if (dto.phone && dto.phone !== existingUser.phone) {
        const duplicatePhoneUser = await this.userRepository.findOne({
          where: { phone: dto.phone },
        });
        if (duplicatePhoneUser) {
          this.logger.warn(`User with phone '${dto.phone}' already exists`);
          throw new ConflictException(
            `User with phone '${dto.phone}' already exists`,
          );
        }
      }

      const newProfileImageUrl = await this.fileUploadService.resolveUrl({
        file,
        bodyUrl: dto.profileImageUrl,
        existingUrl: existingUser.profileImageKey || '',
        path: 'users/profile',
      });

      const updatedUser = await this.userRepository.preload({
        id,
        ...updateUserDto,
        profileImageKey: newProfileImageUrl,
      });

      if (!updatedUser) {
        this.logger.warn(`User with ID '${id}' not found`);
        throw new NotFoundException(`User with ID '${id}' not found`);
      }

      if (dto.password) {
        updatedUser.password = dto.password;
      }

      const savedUser = await this.userRepository.save(updatedUser);

      const { oldValue, newValue } = diffAuditValues(existingUser, savedUser, [
        ...Object.keys(updateUserDto),
        ...(file ? ['profileImageUrl'] : []),
      ]);

      await this.fileUploadService.replace(
        newProfileImageUrl,
        existingUser.profileImageKey || '',
      );
      this.logger.log(`User updated with ID: ${savedUser.id}`);

      if (actor.subjectType === 'ADMIN') {
        await this.logQueueService.enqueueAuditLog({
          adminId: actor.id,
          action: LogAction.UPDATE,
          description: 'Admin updated a user',
          entityName: 'User',
          entityId: savedUser.id,
          oldValue,
          newValue,
          status: LogStatus.SUCCESS,
          ...buildRequestContext(request),
        });
      } else {
        await this.logQueueService.enqueueActivityLog({
          userId: actor.id,
          action: LogAction.UPDATE,
          description: 'User updated their own profile',
          resourceType: 'User',
          resourceId: savedUser.id,
          status: LogStatus.SUCCESS,
          ...buildRequestContext(request),
        });
      }

      return savedUser;
    } catch (error) {
      if (actor.subjectType === 'ADMIN') {
        await this.logQueueService.enqueueAuditLog({
          adminId: actor.id,
          action: LogAction.UPDATE,
          description: 'User update failed',
          entityName: 'User',
          entityId: id,
          status: LogStatus.FAILURE,
          ...buildRequestContext(request),
        });
      } else {
        await this.logQueueService.enqueueActivityLog({
          userId: actor.id,
          action: LogAction.UPDATE,
          description: 'User profile update failed',
          resourceType: 'User',
          resourceId: id,
          status: LogStatus.FAILURE,
          ...buildRequestContext(request),
        });
      }
      throw error;
    }
  }

  async updateOwnProfile(
    currentUserId: string,
    updateUserDto: UpdateUserDto,
    file: Express.Multer.File | undefined,
    request: Request,
  ): Promise<User> {
    return this.update(
      currentUserId,
      updateUserDto,
      file,
      { id: currentUserId, subjectType: 'USER' },
      request,
    );
  }

  async remove(id: string, adminId: string, request: Request): Promise<void> {
    try {
      const existingUser = await this.userRepository.findOne({
        where: { id },
      });
      if (!existingUser) {
        throw new NotFoundException(`User with ID '${id}' not found`);
      }

      await this.fileUploadService.remove(existingUser.profileImageKey || '');

      await this.userRepository.softRemove(existingUser);
      this.logger.log(
        `User with ID '${id}' has been successfully soft deleted`,
      );

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.DELETE,
        description: 'Admin deleted a user',
        entityName: 'User',
        entityId: id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.DELETE,
        description: 'User deletion failed',
        entityName: 'User',
        entityId: id,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  // ─── Auth-oriented methods (consumed by AuthModule) ───────────────────────

  async findByIdNullable(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
  }

  async findByAppleId(appleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { appleId } });
  }

  /**
   * Loads a user by phone including the `select: false` password column.
   * For credential validation only — never expose the returned entity directly.
   */
  async findByPhoneWithPassword(phone: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.phone = :phone', { phone })
      .getOne();
  }

  /**
   * Loads a user by id including the `select: false` password column.
   * For credential validation only — never expose the returned entity directly.
   */
  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByOAuth(
    provider: 'GOOGLE' | 'APPLE',
    providerId: string,
    email?: string,
  ): Promise<User | null> {
    const idField = provider === 'GOOGLE' ? 'googleId' : 'appleId';
    const conditions: FindOptionsWhere<User>[] = [{ [idField]: providerId }];
    if (email) conditions.push({ email });

    return this.userRepository.findOne({ where: conditions });
  }

  async findByIdWithRefreshTokens(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['refreshTokens'],
    });
  }

  async saveEntity(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  async createEntity(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async updateFields(id: string, data: Partial<User>): Promise<void> {
    await this.userRepository.update(id, data);
  }

  async preloadEntity(data: DeepPartial<User>): Promise<User | undefined> {
    return this.userRepository.preload(data);
  }

  async softDeleteEntity(user: User): Promise<void> {
    await this.userRepository.softRemove(user);
  }

  async isPhoneRegistered(phone: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: {
        phone,
      },
      withDeleted: false,
    });

    if (!user) {
      return false;
    }

    return Boolean(user.password || user.googleId || user.appleId);
  }
}
