import { Controller, Get, Query } from '@nestjs/common';
import { BaseService } from './base.service';
import { ClearCacheDto } from './dto/cache.dto';
import { ApiResponses } from '../common/swagger/api-responses.decorator';
import { ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { NavigationService } from './navigation/navigation.service';
import { TaxonomyService } from './taxonomy/taxonomy.service';
import { LabelService } from './label/label.service';
import { CachingService } from '../common/caching/caching.service';
import { CacheTypes } from '../common/enums/caching.enum';

@Controller('api')
export class BaseController {
  constructor(
    private readonly baseService: BaseService,
    private readonly navigationService: NavigationService,
    private readonly taxonomyService: TaxonomyService,
    private readonly labelService: LabelService,
    private readonly cachingService: CachingService,
  ) {}

  @ApiExcludeEndpoint()
  handleWildcardGetRoute() {
    return 'Handling wildcard GET route...';
  }

  @Get('/system/health')
  @ApiOperation({
    summary: 'Check if the middleware application is running and healthy',
  })
  @ApiResponses()
  async healthCheck() {
    const externalServiceStatus = await this.baseService.checkExternalService();

    return {
      status: 'OK',
      externalService: externalServiceStatus,
    };
  }

  @Get('/clearCache')
  @ApiOperation({ summary: 'Refresh the application cache' })
  @ApiResponses()
  async clearCache(@Query() query: ClearCacheDto): Promise<any> {
    const type = query.type;
    const url = query.url;
    
    const startTime = Date.now();

    try {
      await this.refreshCache(type, url);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        message: `Cache ${type} refreshed successfully`,
        type: type,
        url: url || 'ALL',
        duration: `${duration}ms`
      };
      
    } catch(error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        message: `Failed to refresh cache ${type}: ${error.message}`,
        type: type,
        url: url || 'ALL',
        duration: `${duration}ms`
      };
    }
  }

  private async refreshCache(type: string, url?: string): Promise<void> {
    switch (type) {
      case CacheTypes.LOCALIZATION:
        await this.baseService.initialize();
        await this.taxonomyService.initialize();
        await this.navigationService.initialize();
        await this.labelService.initialize();
        break;
        
      case CacheTypes.NAVIGATION:
        if (url) {
          await this.navigationService.loadNavigationByLocale(url);
        } else {
          await this.navigationService.initialize();
        }
        break;
        
      case CacheTypes.CATEGORYWITHKEYWORD:
        if (url) {
          const pubId = await this.baseService.getPublicationIdByLocale(url);
          await this.baseService.fetchAllCategoriesAndKeywords(pubId);
        } else {
          await this.taxonomyService.initialize();
        }
        break;

      case CacheTypes.PAGE:
      case CacheTypes.PAGEMETA:
      case CacheTypes.COMPONENTLIST:
      case CacheTypes.LABEL:
      case CacheTypes.CATEGORY:
      case CacheTypes.KEYWORD:
      case CacheTypes.HEADER:
      case CacheTypes.FOOTER:
      case CacheTypes.REDIRECTS:
        await this.cachingService.reset(type, url);
        break;

      case CacheTypes.ALL:
        await this.baseService.initialize();
        await this.taxonomyService.initialize();
        await this.navigationService.initialize();
        await this.labelService.initialize();
        break;
        
      default:
        throw new Error(`Unsupported cache type: ${type}`);
    }
  }

  @Get('/flushCache')
  @ApiOperation({ summary: 'Flush the application cache' })
  @ApiResponses()
  async flushCache(@Query() query: ClearCacheDto): Promise<any> {
    const message = await this.cachingService.reset(query.type, query.url);

    return message;
  }
}
