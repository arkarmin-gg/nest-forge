import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationFilterDto } from './pagination-filter.dto';

export class SortableFilterDto extends PaginationFilterDto {
  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
