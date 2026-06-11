import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const logger = new Logger('Redis');

export const RedisProvider: Provider = {
  provide: 'REDIS_CLIENT',
  useFactory: async (configService: ConfigService) => {
    const host = configService.get<string>('REDIS_HOST');
    const port = parseInt(configService.get<string>('REDIS_PORT', '6379'));
    const useTls = configService.get<string>('REDIS_TLS', 'false') === 'true';

    // Optional auth. ElastiCache/Valkey serverless with RBAC needs an ACL
    // user + password over TLS. Only set when provided so local no-auth
    // Redis (e.g. localhost) keeps working.
    const username = configService.get<string>('REDIS_USERNAME');
    const password = configService.get<string>('REDIS_PASSWORD');

    logger.log(
      `Connecting to Redis: ${host}:${port}, TLS=${useTls}, auth=${password ? 'yes' : 'no'}`,
    );

    const client = new Redis({
      host,
      port,
      tls: useTls ? { rejectUnauthorized: false } : undefined,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),

      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });

    client.on('connect', () => logger.log('Redis connected'));
    client.on('error', (err) => logger.error('Redis error', err));

    try {
      await client.set('health_check', 'ok', 'PX', 5000);
      logger.log('Redis health check passed');
    } catch (err) {
      logger.error('Redis health check FAILED', err);
      throw err;
    }

    return client;
  },
  inject: [ConfigService],
};