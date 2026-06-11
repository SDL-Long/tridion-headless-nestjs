import { Test, TestingModule } from '@nestjs/testing';
import { GraphqlAuthService } from './graphql-auth.service';

describe('GraphqlAuthService', () => {
  let service: GraphqlAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphqlAuthService],
    }).compile();

    service = module.get<GraphqlAuthService>(GraphqlAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
