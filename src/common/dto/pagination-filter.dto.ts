import { IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ToBoolean } from 'src/common/decorators';

export class PaginationFilterDto {
  @IsOptional()
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Type(() => Number)
  limit: number = 10;

  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  getAll: boolean = false;
}
