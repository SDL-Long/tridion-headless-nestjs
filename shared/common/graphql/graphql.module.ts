import { Module, Logger } from '@nestjs/common';
import { GraphqlClientService } from './graphql-client.service';
import { GraphqlAuthService } from './graphql-auth.service';
import { TridionService } from './tridion.service';
import { CachingModule } from '../caching/caching.module';
import { ConfigModule } from '@nestjs/config';
import { HttpConfigModule } from '../http/http-config.module';

@Module({
  imports: [ConfigModule, CachingModule, HttpConfigModule],
  providers: [GraphqlClientService, GraphqlAuthService, TridionService, Logger],
  exports: [TridionService, GraphqlAuthService],
})
export class GraphqlModule {}
