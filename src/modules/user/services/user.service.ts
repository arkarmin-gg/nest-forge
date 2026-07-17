import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileUploadService } from 'src/common/services';
import {
  parseRangeEnd,
  parseRangeStart,
  resolveSortField,
} from 'src/common/utils';
import { attachAuditLogMetadata, diffAuditValues } from 'src/modules/log/api';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { FilterUserDto } from '../dto/filter-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

const VALID_SORT_FIELDS: (keyof User)[] = ['createdAt'];

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    file?: Express.Multer.File,
  ): Promise<User> {
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

    return savedUser;
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

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    file?: Express.Multer.File,
  ): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    // PartialType uses runtime reflection — cast once to access inherited properties
    const dto = updateUserDto as Partial<CreateUserDto>;

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

    attachAuditLogMetadata(
      savedUser,
      diffAuditValues(existingUser, savedUser, [
        ...Object.keys(updateUserDto),
        ...(file ? ['profileImageUrl'] : []),
      ]),
    );

    await this.fileUploadService.replace(
      newProfileImageUrl,
      existingUser.profileImageKey || '',
    );
    this.logger.log(`User updated with ID: ${savedUser.id}`);

    return savedUser;
  }

  async remove(id: string): Promise<void> {
    const existingUser = await this.userRepository.findOne({
      where: { id },
    });
    if (!existingUser) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    await this.fileUploadService.remove(existingUser.profileImageKey || '');

    await this.userRepository.softRemove(existingUser);
    this.logger.log(`User with ID '${id}' has been successfully soft deleted`);
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
