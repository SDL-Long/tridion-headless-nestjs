import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { CacheTypes } from '../../common/enums/caching.enum';

export class ClearCacheDto {
  @ApiProperty({
    description:
      'Type of the cache to clear. The field **url** is not required when selecting ALL, LOCALIZATION, CONTENTURI, etc.',
    enum: CacheTypes,
    type: String,
    example: CacheTypes.ALL,
  })
  @IsEnum(CacheTypes)
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    description:
      'Optional url for cache to clear. If the data to be cleared is not general, this field needs to be filled in.',
    example: '/en-us/home',
    type: String,
  })
  @IsString()
  @IsOptional()
  url?: string;
}
