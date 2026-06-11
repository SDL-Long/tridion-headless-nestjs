import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { BaseModule } from './base/base.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/global-exception.filter';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV ? `${process.env.NODE_ENV}.env` : '.env',
    }),
    CommonModule,
    BaseModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    Logger,
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {
  constructor() {
    console.log(`Application is running in ${process.env.NODE_ENV || 'default'} mode.`);

    if (!process.env.NODE_ENV) {
      console.warn('Warning: NODE_ENV is not set. Using default `.env` file.');
    }
  }
}
