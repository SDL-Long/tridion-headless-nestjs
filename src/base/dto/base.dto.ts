import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class BaseDto {
  @ApiProperty({
    description: 'The url of the request, including the full path.',
    example: 'en-us/example/article.html',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  readonly url: string;
}

export class LocaleDto {
  @ApiProperty({
    description: 'The locale of the request, representing the language and region.',
    example: 'en-us',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  readonly locale: string;
}
