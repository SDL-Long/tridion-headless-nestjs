import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiResponseStatus } from './api-response-status.enum';
import { ApiResponseWrapper } from './api-response-wrapper.dto';

//TODO: This Wrapper can be used on response of endpoint with specific type
export function ApiResponsesWithWrapper() {
  return applyDecorators(
    ApiResponse({
      status: ApiResponseStatus.OK,
      description: 'Request was successful.',
      type: ApiResponseWrapper,
    }),
    ApiResponse({
      status: ApiResponseStatus.BAD_REQUEST,
      description: 'The request was invalid or cannot be otherwise served.',
      type: ApiResponseWrapper,
    }),
    ApiResponse({
      status: ApiResponseStatus.UNAUTHORIZED,
      description: 'Request Unauthorized.',
      type: ApiResponseWrapper,
    }),
    ApiResponse({
      status: ApiResponseStatus.FORBIDDEN,
      description: 'The request was valid, but the server is refusing action.',
      type: ApiResponseWrapper,
    }),
    ApiResponse({
      status: ApiResponseStatus.NOT_FOUND,
      description: 'Resource not found.',
      type: ApiResponseWrapper,
    }),
    ApiResponse({
      status: ApiResponseStatus.INTERNAL_SERVER_ERROR,
      description: 'An unexpected error occurred on the server.',
      type: ApiResponseWrapper,
    }),
  );
}
