import { Transform } from 'class-transformer';
import { applyDecorators } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';

export function QueryArray(separator = '^') {
  return applyDecorators(
    Transform(({ value }) => {
      // Support ?subtype=a&subtype=b
      if (Array.isArray(value)) return value;  
      // Support insert sign like , ;
      if (typeof value === 'string') {
        return value.split(separator).map(v => v.trim()); 
      }
      return [];
    }, { toClassOnly: true }),
    IsString({ each: true }),
    IsOptional(),
    IsArray(),
  );
}