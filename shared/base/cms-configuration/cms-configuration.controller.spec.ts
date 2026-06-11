import { Test, TestingModule } from '@nestjs/testing';
import { CmsConfigurationController } from './cms-configuration.controller';

describe('CmsConfigurationController', () => {
  let controller: CmsConfigurationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CmsConfigurationController],
    }).compile();

    controller = module.get<CmsConfigurationController>(CmsConfigurationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
