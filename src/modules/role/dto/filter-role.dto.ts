import { IsOptional, IsString } from 'class-validator';
import { PaginationFilterDto } from 'src/common/dto';

export class FilterRoleDto extends PaginationFilterDto {
  @IsOptional()
  @IsString()
  search?: string;
}
