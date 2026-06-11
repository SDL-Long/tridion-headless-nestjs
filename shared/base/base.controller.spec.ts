import { Test, TestingModule } from '@nestjs/testing';
import { BaseController } from './base.controller';
import { BaseService } from './base.service';
import { ClearCacheDto } from './dto/cache.dto';

describe('BaseController', () => {
  let controller: BaseController;
  let baseService: BaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BaseController],
      providers: [
        {
          provide: BaseService,
          useValue: {
            clearCacheByType: jest.fn(),
            checkExternalService: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BaseController>(BaseController);
    baseService = module.get<BaseService>(BaseService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWildcardGetRoute', () => {
    it('should return a wildcard GET route message', () => {
      const result = controller.handleWildcardGetRoute();

      expect(result).toBe('Handling wildcard GET route...');
    });
  });

  describe('clearCache', () => {
    it('should clear cache and return a response', async () => {
      const query: ClearCacheDto = { type: 'ALL' };
      const clearCacheByTypeMock = jest
        .spyOn(baseService, 'clearCacheByType')
        .mockResolvedValue('All cache cleared successfully');
      const result = await controller.clearCache(query);

      expect(clearCacheByTypeMock).toHaveBeenCalledWith('ALL', undefined);
      expect(result).toBe('All cache cleared successfully');
    });
  });

  describe('healthCheck', () => {
    it('should return the health status', async () => {
      const checkExternalServiceMock = jest
        .spyOn(baseService, 'checkExternalService')
        .mockResolvedValue('Healthy');
      const result = await controller.healthCheck();

      expect(checkExternalServiceMock).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'OK',
        externalService: 'Healthy',
      });
    });
  });
});
