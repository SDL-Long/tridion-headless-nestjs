import { Test, TestingModule } from '@nestjs/testing';
import { CmsConfigurationService } from './cms-configuration.service';

describe('CmsConfigurationService', () => {
  let service: CmsConfigurationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CmsConfigurationService],
    }).compile();

    service = module.get<CmsConfigurationService>(CmsConfigurationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
