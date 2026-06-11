import { Injectable, Logger } from '@nestjs/common';
import { GraphqlClientService } from './graphql-client.service';

@Injectable()
export class TridionService {
  constructor(
    private readonly graphqlClientService: GraphqlClientService,
    private readonly logger: Logger,
  ) {}

  SERVICE: string = TridionService.name;

  async initialize() {
    await this.graphqlClientService.getClient();
    this.logger.log('TridionService initialized (lazy mode)');
  }

  async query(query: any, variables: any): Promise<any> {
    const client = await this.graphqlClientService.getClient();
    this.logger.debug(`variables are ${JSON.stringify(variables)}`);
    const response = await client.query({
      fetchPolicy: 'network-only',
      query: query,
      variables: variables,
    });

    return response;
  }
}
