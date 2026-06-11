import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsNotEmpty, IsOptional, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';

export class ComponentDto {
  @ApiProperty({
    description:
      'The locale(s) for the components. For example, "en-us" for a single locale or "en-us,sc-cn" for multiple locales.',
    example: 'en-us',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  readonly locale: string;

  @ApiPropertyOptional({
    description: 'Id of CMS schema with highest priority (required if title and type are absent).',
    example: 12345,
    type: Number,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  readonly id?: number;

  @ApiPropertyOptional({
    description: 'Schema Title (required if id and type are absent).',
    example: 'article',
    type: String,
  })
  @IsString()
  @IsOptional()
  readonly title?: string;

  @ApiPropertyOptional({
    description:
      'Type(s) of Schema (required if id and title are absent). Comma-separated string for multiple values.',
    example: 'COMMON,CUSTOM',
    type: String,
  })
  @IsString()
  @IsOptional()
  type?: string;
}
