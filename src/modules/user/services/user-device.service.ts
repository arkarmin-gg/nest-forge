import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { buildRequestContext } from 'src/common/utils';
import {
  LogAction,
  LogQueueService,
  LogStatus,
} from 'src/modules/log/public-api';
import { Repository } from 'typeorm';
import { UpsertUserDeviceDto } from '../dto/upsert-user-device.dto';
import { UserDevice } from '../entities/user-device.entity';

@Injectable()
export class UserDeviceService {
  constructor(
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    private readonly logQueueService: LogQueueService,
  ) {}

  async findAllForUser(userId: string): Promise<UserDevice[]> {
    return this.userDeviceRepository.find({
      where: { userId },
      order: { lastSeenAt: 'DESC' },
    });
  }

  async upsertForUser(
    userId: string,
    deviceId: string,
    dto: UpsertUserDeviceDto,
    request: Request,
  ): Promise<UserDevice> {
    try {
      const existingDevice = await this.userDeviceRepository.findOne({
        where: { userId, deviceId },
        withDeleted: true,
      });

      const device =
        existingDevice ??
        this.userDeviceRepository.create({
          userId,
          deviceId,
        });

      if (existingDevice?.deletedAt) {
        await this.userDeviceRepository.restore(existingDevice.id);
      }

      device.fcmToken = dto.fcmToken;
      device.platform = dto.platform;
      device.appVersion = dto.appVersion ?? null;
      device.deviceModel = dto.deviceModel ?? null;
      device.osVersion = dto.osVersion ?? null;
      device.lastSeenAt = new Date();
      device.deletedAt = undefined;

      const savedDevice = await this.userDeviceRepository.save(device);

      await this.enqueueDeviceActivityLog({
        userId,
        deviceId,
        platform: dto.platform,
        hasFcmToken: dto.fcmToken !== null,
        action: LogAction.UPDATE,
        description: 'User upserted device registration',
        resourceId: savedDevice.id,
        status: LogStatus.SUCCESS,
        request,
      });

      return savedDevice;
    } catch (error) {
      await this.enqueueDeviceActivityLog({
        userId,
        deviceId,
        platform: dto.platform,
        hasFcmToken: dto.fcmToken !== null,
        action: LogAction.UPDATE,
        description: 'User device registration upsert failed',
        status: LogStatus.FAILURE,
        request,
      });
      throw error;
    }
  }

  async removeForUser(
    userId: string,
    deviceId: string,
    request: Request,
  ): Promise<void> {
    const existingDevice = await this.userDeviceRepository.findOne({
      where: { userId, deviceId },
    });

    if (!existingDevice) {
      return;
    }

    await this.userDeviceRepository.softRemove(existingDevice);

    await this.enqueueDeviceActivityLog({
      userId,
      deviceId,
      platform: existingDevice.platform,
      hasFcmToken: false,
      action: LogAction.DELETE,
      description: 'User deleted device registration',
      resourceId: existingDevice.id,
      status: LogStatus.SUCCESS,
      request,
    });
  }

  private async enqueueDeviceActivityLog(data: {
    userId: string;
    deviceId: string;
    platform: string;
    hasFcmToken: boolean;
    action: LogAction;
    description: string;
    resourceId?: string;
    status: LogStatus;
    request: Request;
  }): Promise<void> {
    await this.logQueueService.enqueueActivityLog({
      userId: data.userId,
      action: data.action,
      description: data.description,
      resourceType: 'UserDevice',
      resourceId: data.resourceId,
      status: data.status,
      metadata: {
        deviceId: data.deviceId,
        platform: data.platform,
        fcmTokenState: data.hasFcmToken ? 'SET' : 'CLEARED',
      },
      ...buildRequestContext(data.request),
    });
  }
}
