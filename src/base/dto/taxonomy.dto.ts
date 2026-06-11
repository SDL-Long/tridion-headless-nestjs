import { IsOptional, IsBoolean, IsString, IsNotEmpty, IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';

// base dto class
export class BaseTaxonomyDto {
  @ApiProperty({
    description: 'Locale of the taxonomy',
    example: 'en-us',
  })
  @IsString()
  @IsNotEmpty()
  readonly locale: string;
}

export class CategoryIdOptionalDto {
  @ApiPropertyOptional({
    description:
      'ID of the category. If provided, this ID will be used as the highest priority for category identification.',
    example: 123,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  readonly categoryId?: number;
}

export class CategoryNameOptionalDto {
  @ApiPropertyOptional({
    description:
      'Name of the category. This is used only if categoryId is not provided. If both categoryId and categoryName are present, categoryId takes precedence.',
    example: 'Technology',
  })
  @IsOptional()
  @IsString()
  readonly categoryName?: string;
}

export class IncludeChildrenAndFlatDto {
  @ApiPropertyOptional({
    description: 'Whether to include children categories. Defaults to false if not provided.',
    example: 'false',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return false;
  }, { toClassOnly: true })
  readonly includeChildren?: boolean;

  @ApiPropertyOptional({
    description:
      'Keywords are nested and displayed with three levels of depth when set **false** otherwise one layer. Defaults to false if not provided.',
    example: 'false',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return false;
  }, { toClassOnly: true })
  @IsBoolean()
  readonly flat?: boolean;
}

export class CategoryIdDto {
  @ApiProperty({
    description: 'ID of the category. This field is required and used for category identification.',
    example: 123,
  })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  readonly categoryId: number;
}

export class KeywordDto {
  @ApiProperty({
    description: 'ID of the keyword. This field is required for keyword identification.',
    example: 456,
  })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  readonly keywordId: number;
}

// combinatorial dto class
export class CategoryChildrenFlatDto extends IntersectionType(
  BaseTaxonomyDto,
  CategoryIdOptionalDto,
  CategoryNameOptionalDto,
  IncludeChildrenAndFlatDto,
) {}

export class KeywordChildrenFlatDto extends IntersectionType(
  BaseTaxonomyDto,
  CategoryIdDto,
  KeywordDto,
  IncludeChildrenAndFlatDto,
) {}
