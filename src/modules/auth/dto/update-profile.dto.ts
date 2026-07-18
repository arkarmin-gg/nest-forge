import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from 'src/modules/user/public-api';

export class UpdateProfileDto extends PartialType(CreateUserDto) {}
