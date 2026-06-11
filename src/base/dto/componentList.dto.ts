import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { QueryArray } from '../../common/decorators/query-array.decorator';

export class ComponentListDto {

  @ApiProperty({
    description:
      'The locale(s) for the components. For example, "en-us" for a single locale or "en-us,sc-cn" for multiple locales.',
    example: 'en-us',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  readonly locale: string;

  @ApiProperty({
    description: 'Number of items in list',
    example: 5,
    type: Number,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  @Transform(
    ({ value }) => {
      return parseInt(value, 10);
    },
    { toClassOnly: true },
  )
  @IsNotEmpty()
  readonly pageSize: number;

  @ApiPropertyOptional({
    description:
      'Start index of items, lets say 1, 11, 21 this is for pagination, if less than 1 then it only show items from 0th Index',
    example: 1,
    type: Number,
  })
  @IsInt()
  @IsPositive()
  @Transform(
    ({ value }) => {
      return parseInt(value, 10);
    },
    { toClassOnly: true },
  )
  @IsOptional()
  readonly start: number;

  @ApiProperty({
    description: 'Schema Title',
    example: 'article',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @ApiPropertyOptional({
    description: 'Metadata Value of Type field for Component list',
    example: 'News, Alerts',
    type: String,
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Metadata Value of SubType field for Component list',
    example: 'Latest Routes, Tourist Attraction',
    type: [String],
  })
  @QueryArray()
  subtype?: string[];

  @ApiPropertyOptional({
    description: 'Metadata Value of label field for Component list showing on cards',
    example: 'limited time offer',
    type: [String],
  })
  @QueryArray()
  label?: string[];

  @ApiPropertyOptional({
    description: 'Metadata Value of tag field for Component list which is used for taxonomy search',
    example: 'limited time offer',
    type: String,
  })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Metadata Value of Device Type field for Component list',
    example: 'Universal, Desktop, Mobile',
    type: String,
  })
  @IsString()
  @IsOptional()
  readonly deviceType: string;

  @ApiPropertyOptional({
    description: 'Maximum total number of items to retrieve',
    example: 500, 
    type: Number,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  @Transform(
    ({ value }) => {
      return parseInt(value, 10);
    },
    { toClassOnly: true },
  )
  readonly maxTotal?: number;
}
