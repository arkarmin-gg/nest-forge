import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { FilterUserDto } from '../dto/filter-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { FileUploadService } from 'src/common/services/file-upload.service';
import {
  attachAuditLogMetadata,
  diffAuditValues,
} from 'src/v1/log/utils/audit-log-metadata.util';
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
}
