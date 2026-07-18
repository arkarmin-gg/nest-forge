import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
  RequireSubject,
  SubjectGuard,
  SubjectType,
} from 'src/modules/auth/public-api';
import {
  UpsertUserDeviceDto,
  UserDeviceAppResponseDto,
  UserDeviceParamDto,
  UserDeviceService,
} from 'src/modules/user/public-api';

@Controller({ path: 'app/me/devices', version: '1' })
@UseGuards(SubjectGuard)
@RequireSubject(SubjectType.USER)
export class UserDeviceAppController {
  constructor(private readonly userDeviceService: UserDeviceService) {}

  @Get()
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserDeviceAppResponseDto[]> {
    const devices = await this.userDeviceService.findAllForUser(currentUser.id);

    return this.toResponseArray(devices);
  }

  @Put(':deviceId')
  async upsert(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param() params: UserDeviceParamDto,
    @Body() dto: UpsertUserDeviceDto,
    @Req() request: Request,
  ): Promise<UserDeviceAppResponseDto> {
    const device = await this.userDeviceService.upsertForUser(
      currentUser.id,
      params.deviceId,
      dto,
      request,
    );

    return this.toResponse(device);
  }

  @Delete(':deviceId')
  @HttpCode(204)
  async remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param() params: UserDeviceParamDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.userDeviceService.removeForUser(
      currentUser.id,
      params.deviceId,
      request,
    );
  }

  private toResponse(value: unknown): UserDeviceAppResponseDto {
    return plainToInstance(UserDeviceAppResponseDto, value, {
      excludeExtraneousValues: true,
    });
  }

  private toResponseArray(value: unknown[]): UserDeviceAppResponseDto[] {
    return plainToInstance(UserDeviceAppResponseDto, value, {
      excludeExtraneousValues: true,
    });
  }
}
