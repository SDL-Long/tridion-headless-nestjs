import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseWrapper<T> {
  @ApiProperty({ description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Response data', type: Object, required: false })
  data?: T;

  @ApiProperty({ description: 'Error details', type: Object, required: false })
  error?: any;
}
