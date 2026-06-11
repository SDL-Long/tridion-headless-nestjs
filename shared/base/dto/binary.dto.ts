import { IsString, IsNotEmpty, IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BinaryComponentUriDto {
  @ApiProperty({
    description:
      'The Content Management (CM) URI of the binary component. The format follows the Tridion format (e.g., tcm:5-12345)',
    type: String,
    example: 'tcm:5-12345',
  })
  @IsString()
  @IsNotEmpty()
  readonly cmUri: string;
}

export class BinaryComponentDto {
  @ApiProperty({
    description: 'The locale representing the language and region.',
    type: String,
    example: 'en-us',
  })
  @IsString()
  @IsNotEmpty()
  readonly locale: string;

  @ApiProperty({
    description:
      'The unique ID of the binary component. This ID must be a positive integer and is used to identify a specific binary asset in the CMS.',
    type: Number,
    example: 12345,
  })
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  readonly binaryId: number;
}
