import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheTypes } from '../enums/caching.enum';
import * as CONSTANTS from '../../constants';
import Redis from 'ioredis';

@Injectable()
export class CachingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  SERVICE: string = CachingService.name;

  private buildKey(type: string, url?: string): string {
    if (!url) return type;

    url = url.trim();

    if (url.startsWith(`${type}:`)) {
      url = url.replace(`${type}:`, '');
    }

    return `${type}:${url}`;
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateToken(): string {
    return Math.random().toString(36).substring(2);
  }

  private async getValue(key: string): Promise<any> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  private async setValue(key: string, value: any, ttl: number) {
    const stringValue = JSON.stringify(value);

    if (ttl && ttl > 0) {
      await this.redis.set(key, stringValue, 'PX', ttl);
    } else {
      await this.redis.set(key, stringValue);
    }
  }

  private async waitForCache(key: string): Promise<any> {
    let delay = 50;

    for (let i = 0; i < 6; i++) {
      await this.sleep(delay);

      const data = await this.getValue(key);
      if (data) return data;

      delay *= 2;
    }

    return null;
  }

  private resolveTtl(type: string): number {
    const map: Record<string, string> = {
      PAGE: 'PAGE_CACHE_TTL',
      PAGEMETA: 'PAGEMETA_CACHE_TTL',
      COMPONENTLIST: 'COMPONENTLIST_CACHE_TTL',
      BINARY: 'BINARY_CACHE_TTL',
      BINARYTYPE: 'BINARY_CACHE_TTL',
      BINARYLASTPUBLISHDATE: 'BINARY_LASTPUBLISHDATE_CACHE_TTL',
      LABEL: 'LABEL_CACHE_TTL',
      CMSCONFIGURATION: 'CMSCONFIGURATION_CACHE_TTL',
      CATEGORY: 'CATEGORYWITHKEYWORD_CACHE_TTL',
      CATEGORYWITHKEYWORD: 'CATEGORYWITHKEYWORD_CACHE_TTL',
      KEYWORD: 'KEYWORD_CACHE_TTL',
      HEADER: 'HEADER_CACHE_TTL',
      FOOTER: 'FOOTER_CACHE_TTL',
      NAVIGATION: 'NAVIGATION_CACHE_TTL',
      REDIRECTS: 'REDIRECTS_CACHE_TTL',
    };

    const key = map[type] || 'DEFAULT_CACHE_TTL';
    return parseInt(this.configService.get(key, '3600000'));
  }

  async getFromCache(type: string, url?: string): Promise<any> {
    this.logger.debug(
      `Fetching cache: ${type}${url ? `, url: ${url}` : ''}`,
      this.SERVICE,
    );

    if (!(type in CacheTypes)) {
      this.logger.warn(`Invalid cache type: ${type}`, this.SERVICE);
      return null;
    }

    try {
      let key: string;

      switch (type) {
        case CacheTypes.LOCALIZATION:
        case CacheTypes.CONTENTURI:
        case CacheTypes.TOKENURI:
        case CacheTypes.TOKEN:
          key = type;
          break;
        default:
          key = this.buildKey(type, url);
      }

      const cached = await this.getValue(key);
      if (cached) {
        return cached;
      }

      const allowWait =
        type !== CacheTypes.TOKEN &&
        type !== CacheTypes.TOKENURI &&
        type !== CacheTypes.LOCALIZATION &&
        type !== CacheTypes.CONTENTURI;

      if (!allowWait) {
        return null;
      }

      // 3. check if someone is building cache
      const lockKey = `LOCK:FALLBACK:${key}`;
      const lockTTL = await this.redis.ttl(lockKey);
      const isFetching = lockTTL > 0;

      if (isFetching) {
        const waited = await this.waitForCache(key);
        return waited;
      }

      return null;

    } catch (error) {
      this.logger.error(`getFromCache error`, error.stack, this.SERVICE);
      throw new InternalServerErrorException(`Error fetching cache`);
    }
  }

  async putIntoCache(type: string, cacheObject: any): Promise<boolean> {
    try {
      let key: string;
      let value: any;
      let ttl: number;

      switch (type) {
        case CacheTypes.LOCALIZATION:
        case CacheTypes.CONTENTURI:
        case CacheTypes.TOKENURI:
          key = type;
          value = cacheObject.payload ?? cacheObject.url;
          ttl = 0;
          break;

        case CacheTypes.TOKEN: {
          key = type;
          value = cacheObject.payload ?? cacheObject;

          const remaining = value.expiresAt - Date.now();
          if (remaining <= 5000) return false;

          ttl = remaining - 5000;
          break;
        }

        default:
          key = this.buildKey(type, cacheObject.url);
          value = cacheObject.payload;
          ttl = cacheObject.ttl ?? this.resolveTtl(type);
      }

      // -----------------------------
      // distributed lock (safe)
      // -----------------------------
      const lockKey = `LOCK:FALLBACK:${key}`;
      const token = this.generateToken();

      const gotLock = await this.redis.set(
        lockKey,
        token,
        'PX',
        10000,
        'NX',
      );

      // someone else is writing cache
      if (!gotLock) {
        return false;
      }

      try {
        await this.setValue(key, value, ttl);
        return true;
      } finally {
        // safe lua unlock
        const lua = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;

        await this.redis.eval(lua, 1, lockKey, token);
      }

    } catch (error) {
      this.logger.error(`putIntoCache error`, error.stack, this.SERVICE);
      throw new InternalServerErrorException(`Error putting cache`);
    }
  }

  async reset(type: string, url?: string): Promise<any> {
    try {
      if (type === CacheTypes.ALL) {
        await this.redis.flushdb();
        return CONSTANTS.MSG_CACHE_CLEARED;
      }

      if (url) {
        const key = this.buildKey(type, url);
        await this.redis.del(key);
        return `Cache cleared for ${key}`;
      }

      let cursor = '0';
      const pattern = `${type}:*`;

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');

      return `Cache cleared for ${type}`;
    } catch (error) {
      this.logger.error(`reset cache error`, error.stack, this.SERVICE);
      throw new InternalServerErrorException(`Error resetting cache`);
    }
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const token = Math.random().toString(36).substring(2);
  
    const ok = await this.redis.set(
      key,
      token,
      'EX',
      ttlSeconds,
      'NX',
    );
  
    return ok ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
  
    await this.redis.eval(lua, 1, key, token);
  }

  // =========================================================
  // SIMPLE HELPERS
  // =========================================================
  async setCache(key: string, value: any, ttl?: number): Promise<void> {
    const effectiveTtl =
      ttl ?? parseInt(this.configService.get('DEFAULT_CACHE_TTL', '300000'));

    await this.setValue(key, value, effectiveTtl);
  }

  async getCache<T = any>(key: string): Promise<T | null> {
    return this.getValue(key);
  }

  async delCache(key: string): Promise<void> {
    await this.redis.del(key);
  }
}