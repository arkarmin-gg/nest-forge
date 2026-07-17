import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { SortableFilterDto } from 'src/common/dto';
import { ToBoolean } from 'src/common/decorators';

export class FilterAdminDto extends SortableFilterDto {
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsBoolean({ message: 'Is banned must be a boolean' })
  @ToBoolean()
  isBanned?: boolean;

  @IsOptional()
  @IsString({ message: 'Role ID must be a string' })
  @IsUUID('4', { message: 'Role ID must be a valid UUID' })
  roleId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
