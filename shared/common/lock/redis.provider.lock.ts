import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisClientProvider {
  public client: Redis;

  constructor(private configService: ConfigService) {
    const useTls = this.configService
      .get<string>('REDIS_TLS', 'false')
      .toLowerCase() === 'true';

    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: parseInt(this.configService.get<string>('REDIS_PORT', '6379'), 10),
    //   password: this.configService.get<string>('REDIS_PASSWORD'),
      tls: useTls ? {} : undefined,
    });
  }
}

