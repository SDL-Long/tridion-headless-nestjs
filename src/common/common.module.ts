import { Module } from '@nestjs/common';
import { GraphqlModule } from './graphql/graphql.module';
import { CachingModule } from './caching/caching.module';
import { UtilsModule } from './utils/utils.module';
import { HttpConfigModule } from './http/http-config.module';

@Module({
  imports: [GraphqlModule, CachingModule, UtilsModule, HttpConfigModule],
  exports: [GraphqlModule, CachingModule, UtilsModule, HttpConfigModule],
})
export class CommonModule {}
