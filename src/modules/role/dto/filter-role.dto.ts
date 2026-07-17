import { IsOptional, IsString } from 'class-validator';
import { SortableFilterDto } from 'src/common/dto';

export class FilterRoleDto extends SortableFilterDto {
  @IsOptional()
  @IsString()
  search?: string;
}
