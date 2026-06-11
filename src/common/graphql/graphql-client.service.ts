import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GraphqlAuthService } from './graphql-auth.service';
import { ConfigService } from '@nestjs/config';
import { CachingService } from '../caching/caching.service';
import { CacheTypes } from '../enums/caching.enum';

import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GraphqlClientService {
  private client: ApolloClient<unknown> | null = null;
  private clientInitializationPromise: Promise<ApolloClient<unknown>> | null = null;

  private readonly discoveryUri: string;

  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitOpen = false;

  private readonly FAILURE_THRESHOLD = 5;
  private readonly OPEN_DURATION = 10000;

  private readonly TIMEOUT: number;

  private contentServiceUri: string | null = null;

  constructor(
    private readonly graphqlAuthService: GraphqlAuthService,
    private readonly configService: ConfigService,
    private readonly cachingService: CachingService,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
  ) {
    this.discoveryUri = this.configService.get<string>('DISCOVERY_SERVICE_URI');

    this.TIMEOUT = parseInt(
      this.configService.get('GRAPHQL_TIMEOUT', '50000'),
    );
  }

  async getClient(): Promise<ApolloClient<unknown>> {
    if (this.client) return this.client;

    if (!this.clientInitializationPromise) {
      this.clientInitializationPromise = this.createClient();
    }

    try {
      return await this.clientInitializationPromise;
    } catch (error) {
      this.logger.error('Client init failed', error);
      this.clientInitializationPromise = null;
      throw new ServiceUnavailableException('CMS unavailable');
    }
  }

  private async createClient(): Promise<ApolloClient<unknown>> {
    const httpLink = new HttpLink({
      uri: '',
      fetch: async (uri: any, options: any) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.TIMEOUT);

        try {
          const token = await this.graphqlAuthService.getAccessToken();
          const serviceUri = await this.getContentServiceUri(token);

          const finalUri = serviceUri;

          return await fetch(finalUri, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      },
    });

    const retryLink = new RetryLink({
      delay: { initial: 300, max: 1500, jitter: true },
      attempts: { max: 2, retryIf: (error) => !!error },
    });

    const errorLink = onError(({ networkError, graphQLErrors }) => {
      if (networkError) this.logger.error('GraphQL network error', networkError);
      if (graphQLErrors) this.logger.error('GraphQL error', graphQLErrors);
    });

    this.client = new ApolloClient({
      link: from([errorLink, retryLink, httpLink]),
      cache: new InMemoryCache(),
      defaultOptions: {
        query: { fetchPolicy: 'network-only' },
      },
    });

    return this.client;
  }

  async query(query: any, variables: any): Promise<any> {
    this.checkCircuit();

    const start = Date.now();

    try {
      const client = await this.getClient();
      const response = await client.query({ query, variables });

      const duration = Date.now() - start;
      this.failureCount = 0;

      if (duration > 5000) {
        this.logger.warn(`Slow GraphQL query: ${duration}ms`);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      this.failureCount++;
      this.lastFailureTime = Date.now();

      this.logger.error(
        `GraphQL failed (${this.failureCount}) after ${duration}ms`,
        error,
      );

      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.circuitOpen = true;
        this.logger.error('Circuit opened!');
      }

      throw new ServiceUnavailableException('CMS request failed');
    }
  }

  private checkCircuit() {
    if (!this.circuitOpen) return;

    const now = Date.now();

    if (now - this.lastFailureTime > this.OPEN_DURATION) {
      this.logger.warn('Circuit half-open, retrying...');
      this.circuitOpen = false;
      this.failureCount = 0;
      return;
    }

    throw new ServiceUnavailableException(
      'CMS temporarily unavailable (circuit open)',
    );
  }

  private async getContentServiceUri(authToken: string): Promise<string> {
    if (this.contentServiceUri) return this.contentServiceUri;
  
    const cached = await this.cachingService.getFromCache(CacheTypes.CONTENTURI);
  
    const rawUri = cached
      ? cached
      : await this.fetchContentUri(authToken);
  
    const finalUri = this.transformUri(rawUri);
  
    this.contentServiceUri = finalUri;
  
    return finalUri;
  }

  private async fetchContentUri(authToken: string): Promise<string> {
    const { data } = await firstValueFrom(
      this.httpService.get(
        `${this.discoveryUri}/ContentServiceCapabilities`,
        { headers: { Authorization: `Bearer ${authToken}` } },
      ),
    );
  
    const uri = data?.value?.[0]?.URI;
  
    if (!uri) {
      throw new ServiceUnavailableException('Content URI not found');
    }
  
    await this.cachingService.putIntoCache(CacheTypes.CONTENTURI, {
      payload: uri,
    });
  
    return uri;
  }

  private transformUri(uri: string): string {
    return uri.replace('content.svc', 'cd/api');
  }
}