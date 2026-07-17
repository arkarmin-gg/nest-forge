import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { FilterAuditLogDto } from '../dto/filter-audit-log.dto';
import { CreateAuditLogData } from '../interfaces/create-audit-log.interface';
import {
  nowUtc,
  parseRangeStart,
  parseRangeEnd,
  subtractDays,
  LOG_RETENTION_DAYS,
  resolveSortField,
} from 'src/common/utils';

const VALID_SORT_FIELDS: (keyof AuditLog)[] = [
  'createdAt',
  'action',
  'entityName',
];

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(data: CreateAuditLogData): Promise<AuditLog> {
    const log = this.auditLogRepository.create(data);
    return this.auditLogRepository.save(log);
  }

  async findAll(
    filterDto: FilterAuditLogDto,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const {
      search,
      adminId,
      action,
      entityName,
      entityId,
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

    const qb = this.auditLogRepository
      .createQueryBuilder('auditLog')
      .leftJoinAndSelect('auditLog.admin', 'admin')
      .orderBy(`auditLog.${orderField}`, sortOrder);

    if (!getAll) {
      qb.skip((page - 1) * limit).take(limit);
    }

    if (search) {
      qb.andWhere(
        '(auditLog.entityName ILIKE :term OR auditLog.ipAddress ILIKE :term OR auditLog.device ILIKE :term OR auditLog.location ILIKE :term)',
        { term: `%${search}%` },
      );
    }

    if (adminId) qb.andWhere('auditLog.adminId = :adminId', { adminId });
    if (action) qb.andWhere('auditLog.action = :action', { action });
    if (entityName)
      qb.andWhere('auditLog.entityName = :entityName', { entityName });
    if (entityId) qb.andWhere('auditLog.entityId = :entityId', { entityId });
    if (ipAddress)
      qb.andWhere('auditLog.ipAddress = :ipAddress', { ipAddress });
    if (device) qb.andWhere('auditLog.device = :device', { device });
    if (location) qb.andWhere('auditLog.location = :location', { location });
    if (status) qb.andWhere('auditLog.status = :status', { status });

    if (startDate && endDate) {
      qb.andWhere('auditLog.createdAt BETWEEN :startDate AND :endDate', {
        startDate: parseRangeStart(startDate),
        endDate: parseRangeEnd(endDate),
      });
    } else if (startDate) {
      qb.andWhere('auditLog.createdAt BETWEEN :startDate AND :now', {
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
    this.logger.log(`Audit logs older than ${LOG_RETENTION_DAYS} days purged`);
  }

  async deleteOldLogs(daysToKeep: number = LOG_RETENTION_DAYS): Promise<void> {
    const cutoffDate = subtractDays(daysToKeep);

    await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('"created_at" < :cutoffDate', { cutoffDate })
      .execute();
  }
}
