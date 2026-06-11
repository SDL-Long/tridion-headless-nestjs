import { Test, TestingModule } from '@nestjs/testing';
import { GraphqlClientService } from './graphql-client.service';

describe('GraphqlClientService', () => {
  let service: GraphqlClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphqlClientService],
    }).compile();

    service = module.get<GraphqlClientService>(GraphqlClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
