import { Module, Logger } from '@nestjs/common';
import { CachingService } from './caching.service';
import { RedisProvider } from './redis.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [CachingService, RedisProvider, Logger],
  exports: [CachingService, RedisProvider],
})
export class CachingModule {}