import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { Logger } from '@nestjs/common';

const logger = new Logger('CacheOptions');

export const CacheOptions: CacheModuleAsyncOptions = {
  isGlobal: true,
  useFactory: async (configService: ConfigService) => {
    const store = configService.get<string>('CACHE_STORE');
    const redisHost = configService.get<string>('REDIS_HOST');
    const redisPort = parseInt(configService.get<string>('REDIS_PORT', '6379'), 10);
    const ttl = parseInt(configService.get<string>('DEFAULT_CACHE_TTL', '60000'), 10);
    const useTls = configService.get<string>('REDIS_TLS', 'false').toLowerCase() === 'true';

    const protocol = useTls ? 'rediss' : 'redis';
    const redisUrl = `${protocol}://${redisHost}:${redisPort}`;

    if (store === 'redis') {
      logger.log('Cache Config:', { store, redisHost, redisPort, ttl });

      try {
        const keyvInstance = createKeyv(redisUrl);

        const compatibleStore = {
          get: (key: string) => keyvInstance.get(key),
          set: (key: string, value: any, ttlMs?: number) => {
            return keyvInstance.set(key, value, ttlMs);
          },
          del: (key: string) => keyvInstance.delete(key), // Keyv using delete instead of del
          reset: () => keyvInstance.clear(),
          keys: (pattern: string = 'keyv:*') => {
            return Promise.resolve([]);
          },
          mget: (...keys: string[]) => Promise.all(keys.map(key => keyvInstance.get(key))),
          mset: (keyValuePairs: [string, any][]) => 
            Promise.all(keyValuePairs.map(([key, value]) => keyvInstance.set(key, value))),
        };

        return { store: compatibleStore, ttl };

      } catch (error) {
        console.error('Redis connection failed and falling back to in-memory store');
        logger.error('Redis connection failed and falling back to in-memory store', error);

        return { ttl };
      }
    } else {
      logger.log('Using in-memory store');
      return { ttl };
    }
  },
  inject: [ConfigService],
  imports: [ConfigModule],
};

