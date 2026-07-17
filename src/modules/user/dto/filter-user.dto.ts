import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { SortableFilterDto } from 'src/common/dto';
import { ToBoolean } from 'src/common/decorators';

export class FilterUserDto extends SortableFilterDto {
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsBoolean({ message: 'Is banned must be a boolean' })
  @ToBoolean()
  isBanned?: boolean;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
