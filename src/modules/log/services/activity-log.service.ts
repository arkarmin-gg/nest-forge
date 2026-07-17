import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../entities/activity-log.entity';
import { FilterActivityLogDto } from '../dto/filter-activity-log.dto';
import { CreateActivityLogData } from '../interfaces/create-activity-log.interface';
import {
  nowUtc,
  parseRangeStart,
  parseRangeEnd,
  subtractDays,
  LOG_RETENTION_DAYS,
  resolveSortField,
} from 'src/common/utils';

const VALID_SORT_FIELDS: (keyof ActivityLog)[] = [
  'createdAt',
  'action',
  'resourceType',
];

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async create(data: CreateActivityLogData): Promise<ActivityLog> {
    const log = this.activityLogRepository.create(data);
    return this.activityLogRepository.save(log);
  }

  async findAll(
    filterDto: FilterActivityLogDto,
  ): Promise<{ items: ActivityLog[]; total: number }> {
    const {
      search,
      userId,
      action,
      resourceType,
      resourceId,
      ipAddress,
      device,
      location,
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder = 'DESC',
      page = 1,
      limit = 10,
      getAll = false,
    } = filterDto;

    const orderField = resolveSortField(sortBy, VALID_SORT_FIELDS, 'createdAt');

    const qb = this.activityLogRepository
      .createQueryBuilder('activityLog')
      .leftJoinAndSelect('activityLog.user', 'user')
      .orderBy(`activityLog.${orderField}`, sortOrder);

    if (!getAll) {
      qb.skip((page - 1) * limit).take(limit);
    }

    if (search) {
      qb.andWhere(
        '(activityLog.resourceType ILIKE :term OR activityLog.ipAddress ILIKE :term OR activityLog.device ILIKE :term OR activityLog.location ILIKE :term)',
        { term: `%${search}%` },
      );
    }

    if (userId) qb.andWhere('activityLog.userId = :userId', { userId });
    if (action) qb.andWhere('activityLog.action = :action', { action });
    if (resourceType)
      qb.andWhere('activityLog.resourceType = :resourceType', {
        resourceType,
      });
    if (resourceId)
      qb.andWhere('activityLog.resourceId = :resourceId', { resourceId });
    if (ipAddress)
      qb.andWhere('activityLog.ipAddress = :ipAddress', { ipAddress });
    if (device) qb.andWhere('activityLog.device = :device', { device });
    if (location) qb.andWhere('activityLog.location = :location', { location });
    if (status) qb.andWhere('activityLog.status = :status', { status });

    if (startDate && endDate) {
      qb.andWhere('activityLog.createdAt BETWEEN :startDate AND :endDate', {
        startDate: parseRangeStart(startDate),
        endDate: parseRangeEnd(endDate),
      });
    } else if (startDate) {
      qb.andWhere('activityLog.createdAt BETWEEN :startDate AND :now', {
        startDate: parseRangeStart(startDate),
        now: nowUtc(),
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  @Cron('0 2 * * *')
  async purgeOldLogs(): Promise<void> {
    await this.deleteOldLogs();
    this.logger.log(
      `Activity logs older than ${LOG_RETENTION_DAYS} days purged`,
    );
  }

  async deleteOldLogs(daysToKeep: number = LOG_RETENTION_DAYS): Promise<void> {
    const cutoffDate = subtractDays(daysToKeep);

    await this.activityLogRepository
      .createQueryBuilder()
      .delete()
      .where('"created_at" < :cutoffDate', { cutoffDate })
      .execute();
  }
}
