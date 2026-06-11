import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiResponseStatus } from './api-response-status.enum';

export function ApiResponses() {
  return applyDecorators(
    ApiResponse({
      status: ApiResponseStatus.OK,
      description: 'Request was successful.',
    }),
    ApiResponse({
      status: ApiResponseStatus.BAD_REQUEST,
      description: 'The request was invalid or cannot be otherwise served.',
    }),
    ApiResponse({
      status: ApiResponseStatus.UNAUTHORIZED,
      description: 'Request Unauthorized.',
    }),
    ApiResponse({
      status: ApiResponseStatus.FORBIDDEN,
      description: 'The request was valid, but the server is refusing action.',
    }),
    ApiResponse({
      status: ApiResponseStatus.NOT_FOUND,
      description: 'Resource not found.',
    }),
    ApiResponse({
      status: ApiResponseStatus.INTERNAL_SERVER_ERROR,
      description: 'An unexpected error occurred on the server.',
    }),
  );
}
