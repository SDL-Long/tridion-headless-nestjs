import { Injectable, Logger } from '@nestjs/common';
import Redlock from 'redlock';
import { RedisClientProvider } from './redis.provider.lock';

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);
  private readonly redlock: Redlock;

  constructor(private readonly redisProvider: RedisClientProvider) {
    this.redlock = new Redlock([this.redisProvider.client], {
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 100,
    });
  }

  async acquireLock(key: string, ttl = 5000) {
    try {
      const lock = await this.redlock.acquire([`lock:${key}`], ttl);
      this.logger.debug(`Lock acquired: ${key}`);
      return lock;
    } catch (err) {
      this.logger.warn(`Failed to acquire lock: ${key}`);
      return null;
    }
  }

  async releaseLock(lock: any) {
    if (!lock) return;
    try {
      await lock.release();
      this.logger.debug(`Lock released`);
    } catch (err) {
      this.logger.error(`Failed to release lock`, err);
    }
  }
}
