import { Module, Global } from '@nestjs/common';
import { LockService } from './lock.service';
import { RedisClientProvider } from './redis.provider.lock';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [RedisClientProvider, LockService],
  exports: [RedisClientProvider, LockService],
  imports: [ConfigModule]
})
export class LockModule {}
