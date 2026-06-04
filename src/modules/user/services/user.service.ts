import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { User, UserRegistrationStage } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { FilterUserDto } from '../dto/filter-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
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
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private fileUploadService: FileUploadService,
  ) {}

  // ─── Admin CRUD operations ────────────────────────────────────────────────

  async create(createUserDto: CreateUserDto, file?: Express.Multer.File) {
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
      const uploadedKey = await this.fileUploadService.uploadProfileImage(
        file,
        'users/profile',
      );
      if (uploadedKey) {
        profileImageUrl = uploadedKey;
      }
    }

    const user = this.userRepository.create({
      ...createUserDto,
      profileImageUrl,
    });
    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User created with ID: ${savedUser.id}`);

    return savedUser;
  }

  async findAll(filter: FilterUserDto) {
    const { getAll, limit, page } = filter;
    const skip = (page - 1) * limit;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

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

  async findOne(id: string) {
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
  ) {
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

    const newProfileImageUrl =
      await this.fileUploadService.resolveProfileImageUrl({
        file,
        bodyUrl: dto.profileImageUrl,
        existingUrl: existingUser.profileImageUrl || '',
        s3Path: 'users/profile',
      });

    const updatedUser = await this.userRepository.preload({
      id,
      ...updateUserDto,
      profileImageUrl: newProfileImageUrl,
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

    await this.fileUploadService.replaceProfileImage(
      newProfileImageUrl,
      existingUser.profileImageUrl || '',
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

    await this.fileUploadService.deleteProfileImage(
      existingUser.profileImageUrl || '',
    );

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

  async findByPhoneAndStage(
    phone: string,
    stage: UserRegistrationStage,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone, registrationStage: stage },
    });
  }

  async findByIdAndStage(
    id: string,
    stage: UserRegistrationStage,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, registrationStage: stage },
    });
  }

  async findByOAuth(
    provider: 'GOOGLE' | 'APPLE',
    providerId: string,
    email?: string,
  ): Promise<User | null> {
    const idField = provider === 'GOOGLE' ? 'googleId' : 'appleId';
    const conditions: FindOptionsWhere<User>[] = [
      { [idField]: providerId } as FindOptionsWhere<User>,
    ];
    if (email) conditions.push({ email } as FindOptionsWhere<User>);

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
}
