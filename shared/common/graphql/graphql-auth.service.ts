import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachingService } from '../caching/caching.service';
import { CacheTypes } from '../enums/caching.enum';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GraphqlAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly discoveryUri: string;

  private tokenUri: string | null = null;

  private memoryToken: { accessToken: string; expiresAt: number } | null = null;

  private readonly TOKEN_LOCK_KEY = 'graphql_token_lock';

  private readonly TOKEN_BUFFER: number;
  private readonly TOKEN_EARLY_EXPIRE: number;
  private readonly LOCK_TTL: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cachingService: CachingService,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
  ) {
    this.clientId = this.configService.get<string>('OAUTH_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('OAUTH_CLIENT_SECRET');
    this.discoveryUri = this.configService.get<string>('DISCOVERY_SERVICE_URI');

    this.TOKEN_BUFFER = parseInt(this.configService.get('TOKEN_BUFFER', '60000'));
    this.TOKEN_EARLY_EXPIRE = parseInt(this.configService.get('TOKEN_EARLY_EXPIRE', '2000'));
    this.LOCK_TTL = parseInt(this.configService.get('TOKEN_LOCK_TTL', '5'));
  }

  async getAccessToken(): Promise<string> {
    if (this.memoryToken && !this.isExpired(this.memoryToken.expiresAt)) {
      return this.memoryToken.accessToken;
    }

    const cached = await this.cachingService.getFromCache(CacheTypes.TOKEN);
    if (cached && !this.isExpired(cached.expiresAt)) {
      this.memoryToken = cached;
      return cached.accessToken;
    }

    this.logger.debug('Token expired, acquiring lock...');

    const lockToken = await this.acquireLock();

    if (lockToken) {
      try {
        return await this.fetchAndCacheToken();
      } finally {
        await this.cachingService.releaseLock(this.TOKEN_LOCK_KEY, lockToken);
      }
    }

    await this.sleep(300);

    const retry = await this.cachingService.getFromCache(CacheTypes.TOKEN);
    if (retry && !this.isExpired(retry.expiresAt)) {
      this.memoryToken = retry;
      return retry.accessToken;
    }

    return await this.fetchAndCacheToken();
  }

  private async fetchAndCacheToken(): Promise<string> {
    const tokenUri = await this.getTokenServiceUri();

    const { data } = await firstValueFrom(
      this.httpService.post(
        tokenUri,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    if (!data?.access_token) {
      throw new ServiceUnavailableException('Token fetch failed');
    }

    const expiresAt =
      Date.now() + data.expires_in * 1000 - this.TOKEN_BUFFER;

    const tokenData = {
      accessToken: data.access_token,
      expiresAt,
    };

    await this.cachingService.putIntoCache(CacheTypes.TOKEN, {
      payload: tokenData,
    });

    this.memoryToken = tokenData;

    this.logger.debug(`Token refreshed & cached`);

    return tokenData.accessToken;
  }

  private async getTokenServiceUri(): Promise<string> {
    if (this.tokenUri) return this.tokenUri;

    const cached = await this.cachingService.getFromCache(CacheTypes.TOKENURI);
    if (cached) {
      this.tokenUri = cached;
      return this.tokenUri;
    }

    const { data } = await firstValueFrom(
      this.httpService.get(
        `${this.discoveryUri}/TokenServiceCapabilities?$format=json`,
      ),
    );

    const uri = data?.value?.[0]?.URI;

    if (!uri) {
      throw new ServiceUnavailableException('Token URI not found');
    }

    await this.cachingService.putIntoCache(CacheTypes.TOKENURI, {
      payload: uri,
    });

    this.tokenUri = uri;

    return uri;
  }

  private async acquireLock(): Promise<string | null> {
    return await this.cachingService.acquireLock(
      this.TOKEN_LOCK_KEY,
      this.LOCK_TTL,
    );
  }

  private isExpired(expiresAt: number): boolean {
    return Date.now() > expiresAt - this.TOKEN_EARLY_EXPIRE;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}