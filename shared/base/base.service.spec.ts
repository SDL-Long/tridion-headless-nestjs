import { Test, TestingModule } from '@nestjs/testing';
import { BaseService } from './base.service';
import { Logger } from '@nestjs/common';
import { TridionService } from '../common/graphql/tridion.service';
import { CachingService } from '../common/caching/caching.service';
import { UtilsService } from '../common/utils/utils.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GET_BINARY_COMPONENT_BY_URL } from './queries/binary.query';

describe('BaseService', () => {
  let baseService: BaseService;
  let tridionService: TridionService;
  let cachingService: CachingService;
  let utilService: UtilsService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaseService,
        {
          provide: Logger,
          useValue: { debug: jest.fn(), error: jest.fn(), log: jest.fn() },
        },
        {
          provide: TridionService,
          useValue: { query: jest.fn() },
        },
        {
          provide: CachingService,
          useValue: { getFromCache: jest.fn() },
        },
        {
          provide: UtilsService,
          useValue: {
            getSiteDomain: jest.fn(),
            getSitePort: jest.fn(),
            getSiteProtocol: jest.fn(),
          },
        },
      ],
    }).compile();

    baseService = module.get<BaseService>(BaseService);
    tridionService = module.get<TridionService>(TridionService);
    cachingService = module.get<CachingService>(CachingService);
    utilService = module.get<UtilsService>(UtilsService);
    logger = module.get<Logger>(Logger);
  });

  describe('getBinaryComponentByUrl', () => {
    it('should return binary component by URL', async () => {
      const mockResponse = { data: { component: 'mockComponent' } };
      jest.spyOn(tridionService, 'query').mockResolvedValueOnce(mockResponse);

      const result = await baseService.getBinaryComponentByUrl(1, 'mockUrl');

      expect(tridionService.query).toHaveBeenCalledWith(GET_BINARY_COMPONENT_BY_URL, {
        namespaceId: 1,
        publicationId: 1,
        url: 'mockUrl',
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getBinaryComponentByCmUri', () => {
    it('should call getBinaryComponentByCmUri with correct cmUri', async () => {
      const mockResponse = { data: 'mockData' };
      jest.spyOn(tridionService, 'query').mockResolvedValue(mockResponse);

      const result = await baseService.getBinaryComponentByCmUri('tcm:1-1');

      expect(tridionService.query).toHaveBeenCalledWith(expect.anything(), {
        namespaceId: 1,
        cmUri: 'tcm:1-1',
      });
      expect(result).toEqual('mockData');
    });
  });

  describe('getBinaryComponentById', () => {
    it('should call getBinaryComponentById with correct publicationId and binaryId', async () => {
      const mockResponse = { data: 'mockData' };
      jest.spyOn(tridionService, 'query').mockResolvedValue(mockResponse);

      const result = await baseService.getBinaryComponentById(1, 100);

      expect(tridionService.query).toHaveBeenCalledWith(expect.anything(), {
        namespaceId: 1,
        publicationId: 1,
        binaryId: 100,
      });
      expect(result).toEqual('mockData');
    });
  });

  describe('resolveComponentLink', () => {
    it('should resolve page component link correctly', async () => {
      const mockResponse = {
        data: {
          component: {
            resolvedLink: { url: 'test-url.html' },
            content: { some: 'content' },
          },
        },
      };
  
      jest.spyOn(tridionService, 'query').mockResolvedValue(mockResponse as any);
  
      const result = await baseService.resolveComponentLink(1, 100);
  
      expect(tridionService.query).toHaveBeenCalledWith(expect.anything(), {
        namespaceId: 1,
        publicationId: 1,
        componentId: 100,
      });
  
      expect(result).toEqual({
        url: 'test-url',
        isBinary: false,
      });
    });
  });  

  describe('extractBinaryIdFromUrl', () => {
    it('should extract binary id from url correctly', () => {
      const url = 'https://www.example.com/path_to_image_tcm1-1.jpg';
      const result = baseService.extractBinaryIdFromUrl(url);
      expect(result).toEqual(1);
    });
  });

  describe('resolveLocalization', () => {
    it('should throw NotFoundException if cache is null', async () => {
      jest.spyOn(cachingService, 'getFromCache').mockResolvedValueOnce(null);

      await expect(baseService.resolveLocalization('mockUri')).rejects.toThrow(NotFoundException);
    });

    it('should return publicationId and locale for valid URI', async () => {
      const mockMappings = [
        {
          path: '/mockUri',
          domain: 'mockDomain',
          port: '80',
          protocol: 'http',
          publicationId: 1,
        },
      ];

      jest.spyOn(cachingService, 'getFromCache').mockResolvedValueOnce(mockMappings);
      jest.spyOn(utilService, 'getSiteDomain').mockReturnValue('mockDomain');
      jest.spyOn(utilService, 'getSitePort').mockReturnValue('80');
      jest.spyOn(utilService, 'getSiteProtocol').mockReturnValue('http');

      const result = await baseService.resolveLocalization('/mockUri');

      expect(result).toEqual({ publicationId: 1, locale: 'mockUri' });
    });

    it('should throw BadRequestException for invalid URI', async () => {
      const mockMappings = [
        {
          path: '/wrongUri',
          domain: 'mockDomain',
          port: '80',
          protocol: 'http',
          publicationId: 1,
        },
      ];

      jest.spyOn(cachingService, 'getFromCache').mockResolvedValueOnce(mockMappings);
      jest.spyOn(utilService, 'getSiteDomain').mockReturnValue('mockDomain');
      jest.spyOn(utilService, 'getSitePort').mockReturnValue('80');
      jest.spyOn(utilService, 'getSiteProtocol').mockReturnValue('http');

      await expect(baseService.resolveLocalization('/mockUri')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
