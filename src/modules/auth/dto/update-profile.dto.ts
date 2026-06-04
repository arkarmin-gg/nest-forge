import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from 'src/modules/user';

export class UpdateProfileDto extends PartialType(CreateUserDto) {}
