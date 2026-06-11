import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AxiosOptions } from './axios-options';

@Module({
  imports: [HttpModule.registerAsync(AxiosOptions)],
  exports: [HttpModule],
})
export class HttpConfigModule {}
