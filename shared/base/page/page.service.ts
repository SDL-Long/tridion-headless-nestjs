import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  Base,
  PageTemplate,
  Component,
  ComponentTemplate,
  Content,
} from '../interfaces/base.interface';
import { BaseService } from '../base.service';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import { GET_PAGE, GET_PAGE_METADATA, GET_ALL_PAGES } from '../queries/page.query';
import { UtilsService } from '../../common/utils/utils.service';
import { TridionService } from '../../common/graphql/tridion.service';
import * as CONSTANTS from '../../constants';

@Injectable()
export class PageService {
  constructor(
    private readonly baseService: BaseService,
    private readonly logger: Logger,
    private readonly cachingService: CachingService,
    private readonly tridionService: TridionService,
    private readonly utilService: UtilsService,
  ) {}

  async initialize() {
    try {
      await this.loadDefaultHeadersFooters();
    } catch (error) {
      this.logger.error(`Error during application bootstrap`, error.stack, this.SERVICE);
      throw new InternalServerErrorException(CONSTANTS.MSG_APP_BOOTSTRAP_FAIL);
    }
  }

  SERVICE: string = PageService.name;

  // templateless method api
  async getPageData(url: string, skipCache: boolean = false): Promise<Base> {
    this.logger.debug(`Fetching page data for URL: ${url}`, this.SERVICE);

    try {
      const normalizedUrl = this.baseService.normalizeUrl(url);

      if (!skipCache) {
        const cachedPageData = await this.cachingService.getFromCache(
          CacheTypes.PAGE,
          normalizedUrl,
        );

        if (cachedPageData) {
          return cachedPageData as Base;
        }
      }

      const { publicationId, locale } = await this.baseService.resolveLocalization(normalizedUrl);

      if (!publicationId) {
        throw new NotFoundException(`Publication not found for URL: ${url}`);
      }

      const variables = {
        namespaceId: 1,
        publicationId: publicationId,
        url: `${normalizedUrl}`,
      };

      const response = await this.tridionService.query(GET_PAGE, variables);
      const base: Base = {} as Base;
      const pageData = response.data?.page;

      if (pageData) {
        await this.convertPageData(pageData, locale, base);
        if (!skipCache) {
          await this.cachingService.putIntoCache(CacheTypes.PAGE, {
            url: normalizedUrl,
            payload: base,
          });
        }
      } else {
        this.logger.warn(`Page not found for URL: ${url}`, this.SERVICE);
        throw new NotFoundException(`Page not found for URL: ${url}`);
      }

      return base;
    } catch (error) {
      this.logger.error(`Error fetching page data for URL: ${url}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  // templateless method api
  async getPageMetadata(url: string): Promise<Base> {
    this.logger.debug(`Fetching page metadata for URL: ${url}`, this.SERVICE);

    try {
      const normalizedUrl = this.baseService.normalizeUrl(url);

      const cachedPageMetaData = await this.cachingService.getFromCache(
        CacheTypes.PAGEMETA,
        normalizedUrl,
      );

      if (cachedPageMetaData) {
        return cachedPageMetaData as Base;
      }

      const { publicationId, locale } = await this.baseService.resolveLocalization(normalizedUrl);

      if (!publicationId) {
        throw new NotFoundException(`Publication not found for URL: ${url}`);
      }

      const variables = {
        namespaceId: 1,
        publicationId: publicationId,
        url: `${normalizedUrl}`,
      };

      const response = await this.tridionService.query(GET_PAGE_METADATA, variables);
      const pageData = response.data?.page;

      if (!pageData) {
        this.logger.error(`Page metadata not found for URL: ${url}`, this.SERVICE);
        throw new NotFoundException(`Page metadata not found for URL: ${url}`);
      }

      const base: Base = {
        publicationId: pageData.publicationId,
        locale: locale,
        id: pageData.itemId,
        title: pageData.title,
        url: pageData.url,
        pageCustomMetadata: await this.baseService.processCustomMetadataAsync(pageData.customMetas?.edges || []),
      };

      await this.cachingService.putIntoCache(CacheTypes.PAGEMETA, {
        url: normalizedUrl,
        payload: base,
      });

      return base;
    } catch (error) {
      this.logger.error(`Error fetching page metadata for URL: ${url}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  private async convertPageData(pageData: any, locale: string, base: Base): Promise<Base> {
    this.logger.debug(`Converting page data: ${pageData.itemId}`, this.SERVICE);

    try {
      base.publicationId = pageData.publicationId;
      base.locale = locale;
      base.id = pageData.itemId;
      base.title = pageData.title;
      base.url = pageData.url;

      const pageTemplate: PageTemplate = {} as PageTemplate;
      pageTemplate.id = pageData.pageTemplate.itemId;
      const pageTemplateENV = 'p' + pageTemplate.id;
      pageTemplate.view = this.utilService.getPageTemplate(pageTemplateENV);
      base.pageTemplate = pageTemplate;
      base.regions = [];
      base.pageCustomMetadata = await this.baseService.processCustomMetadataAsync(pageData.customMetas?.edges || []);

      await this.addHeaderAndFooterToPage(base, locale);

      if (pageData.regions?.length) {
        for (const region of pageData.regions) {
          const components: Component[] = [];
          this.logger.debug('Processing region: ' + region.name);
          if (region.components?.length) {
            await this.processComponents(region.components, base.id, components);
            base.regions.push({ name: region.name, components });
          } else {
            this.logger.debug(`Region ${region.name} has no components.`);
          }
        }
      }

      if (pageData.components?.length) {
        const components: Component[] = [];
        await this.processComponents(pageData.components, base.id, components);
        base.components = components;
      }

      // Move Main region components outside of region
      const mainRegion = base.regions.find((region) => region.name === 'Main');
      if (mainRegion) {
        base.components = [...(base.components || []), ...(mainRegion.components || [])];
      }

      // Remove Main region from regions
      base.regions = base.regions.filter((region) => region.name !== 'Main');

      // Remove empty regions
      base.regions = base.regions.filter((region) => region.components.length > 0);
      
      return base;
    } catch (error) {
      this.logger.error(
        `Error converting page data: ${pageData.itemId}`,
        error.stack,
        this.SERVICE,
      );
      throw new InternalServerErrorException(`Error converting page data: ${pageData.itemId}`);
    }
  }

  private async processComponents(
    componentsData: any[],
    baseId: number,
    components: Component[],
  ): Promise<void> {
    for (const currentComponent of componentsData) {
      const comp = await this.processComponent(currentComponent, baseId);
      components.push(comp);
    }
  }

  async processComponent(currentComponent: any, baseId: number): Promise<Component> {
    const comp: Component = {} as Component;
    comp.id = currentComponent.itemId;
    comp.title = currentComponent.title;
    comp.schemaId = currentComponent.schemaId;
    comp.resolvedLink = currentComponent.resolvedLink?.url?.replace(/\.html(?=[?#]|$)/gi, '');

    const componentTemplate: ComponentTemplate = {} as ComponentTemplate;
    const compTemplateENV = 'c' + currentComponent.schemaId;
    componentTemplate.view = this.utilService.getComponentTemplate(compTemplateENV);
    comp.componentTemplate = componentTemplate;
    comp.componentCustomMetadata = this.baseService.processCustomMetadata(
      currentComponent.customMetas?.edges || [],
    );

    const content: Content = {} as Content;
    await this.baseService.processNestedFields(currentComponent.content?.data, content, baseId);
    comp.content = content;

    return comp;
  }

  async addHeaderAndFooterToPage(base: Base, locale: string) {
    const headerPageUrl = base.pageCustomMetadata['headerPage'];
    const footerPageUrl = base.pageCustomMetadata['footerPage'];
    const defaultHeaderPath = this.utilService.getDefaultHeaderPath();
    const defaultFooterPath = this.utilService.getDefaultFooterPath();

    base.isDefaultHeader = true;
    base.header = locale + defaultHeaderPath;

    if (
      !(headerPageUrl === undefined || headerPageUrl == '') &&
      headerPageUrl != defaultHeaderPath
    ) {
      base.isDefaultHeader = false;
    }

    base.isDefaultFooter = true;
    base.footer = locale + defaultFooterPath;

    if (
      !(footerPageUrl === undefined || footerPageUrl == '') &&
      footerPageUrl != defaultFooterPath
    ) {
      base.isDefaultFooter = false;
    }

    if (!base.isDefaultHeader) {
      base.header = locale + headerPageUrl;
    }

    if (!base.isDefaultFooter) {
      base.footer = locale + footerPageUrl;
    }

    return;
  }

  async addHeaderToCache(headerPageUrl: string, pageData?: Base) {
    const cachedHeaderPage: Base = await this.cachingService.getFromCache(
      CacheTypes.HEADER,
      headerPageUrl,
    );

    if (!cachedHeaderPage) {
      const headerPageData = pageData;
      await this.cachingService.putIntoCache(CacheTypes.HEADER, {
        url: headerPageUrl,
        payload: headerPageData,
      });
    }
  }

  async addFooterToCache(footerPageUrl: string, pageData?: Base) {
    const cachedFooterPage: Base = await this.cachingService.getFromCache(
      CacheTypes.FOOTER,
      footerPageUrl,
    );

    if (!cachedFooterPage) {
      const footerPageData = pageData;
      await this.cachingService.putIntoCache(CacheTypes.FOOTER, {
        url: footerPageUrl,
        payload: footerPageData,
      });
    }
  }

  async getDefaultHeader(path: string, appLoading: boolean): Promise<Base> {
    //Get Default header page from cache (assume: it must be cached via scheduled job)
    this.logger.debug(`Get Default Header for path - ${path}`, this.SERVICE);

    try {
      if (path === '/') {
        path = '';
      }

      const defaultHeaderPageUrl = path + this.utilService.getDefaultHeaderPath();

      let defaultHeaderPageData: Base;
      defaultHeaderPageData = await this.cachingService.getFromCache(
        CacheTypes.HEADER,
        defaultHeaderPageUrl,
      );
      if (!defaultHeaderPageData) {
        defaultHeaderPageData = await this.getPageData(defaultHeaderPageUrl, true);
        await this.addHeaderToCache(defaultHeaderPageUrl, defaultHeaderPageData);
      }
      return defaultHeaderPageData;
    } catch (error) {
      if (error instanceof NotFoundException && appLoading) {
        this.logger.error(`Error getting default header for path - ${path}`);
      } else {
        throw error;
      }
    }
  }

  async getDefaultFooter(path: string, appLoading: boolean): Promise<Base> {
    this.logger.debug(`Get Default Footer for path - ${path}`, this.SERVICE);

    try {
      if (path === '/') {
        path = '';
      }

      const defaultFooterPageUrl = path + this.utilService.getDefaultFooterPath();

      let defaultFooterPageData: Base;
      defaultFooterPageData = await this.cachingService.getFromCache(
        CacheTypes.FOOTER,
        defaultFooterPageUrl,
      );
      if (!defaultFooterPageData) {
        defaultFooterPageData = await this.getPageData(defaultFooterPageUrl, true);
        this.addFooterToCache(defaultFooterPageUrl, defaultFooterPageData);
      }
      return defaultFooterPageData;
    } catch (error) {
      if (error instanceof NotFoundException && appLoading) {
        this.logger.error(`Error getting default footer for path - ${path}`);
      } else {
        throw error;
      }
    }
  }

  async getHeader(headerPageUrl: string): Promise<Base> {
    this.logger.debug(`Get Header for url - ${headerPageUrl}`, this.SERVICE);

    try {
      let headerPageData: Base;
      headerPageData = await this.cachingService.getFromCache(CacheTypes.HEADER, headerPageUrl);
      if (!headerPageData) {
        headerPageData = await this.getPageData(headerPageUrl, true);
        if (!(Object.keys(headerPageData).length === 0)) {
          await this.addHeaderToCache(headerPageUrl, headerPageData);
        }
      }
      return headerPageData;
    } catch (error) {
      this.logger.error(`Error getting header for url - ${headerPageUrl}`, error.stack);
      throw error;
    }
  }

  async getFooter(footerPageUrl: string): Promise<Base> {
    this.logger.debug(`Get Footer for url - ${footerPageUrl}`, this.SERVICE);

    try {
      let footerPageData: Base;
      footerPageData = await this.cachingService.getFromCache(CacheTypes.FOOTER, footerPageUrl);

      if (!footerPageData) {
        footerPageData = await this.getPageData(footerPageUrl, true);
        if (!(Object.keys(footerPageData).length === 0)) {
          this.addFooterToCache(footerPageUrl, footerPageData);
        }
      }

      return footerPageData;
    } catch (error) {
      this.logger.error(`Error getting footer for url - ${footerPageUrl}`, error.stack);
      throw error;
    }
  }

  async loadDefaultHeadersFooters(): Promise<void> {
    this.logger.debug(`Load default headers and footers`, this.SERVICE);
  
    try {
      let cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);
  
      if (!cachedLocalizations || cachedLocalizations.length === 0) {
        this.logger.warn(
          `${CONSTANTS.ERROR_LOCALIZATIONS_NOT_FOUND}, try reload from CMS`,
        );
  
        await this.baseService.loadLocalizations();
  
        cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);
  
        if (!cachedLocalizations || cachedLocalizations.length === 0) {
          this.logger.error(
            `Reload localization failed, skip header/footer preload`,
          );
          return;
        }
      }
  
      await Promise.all(
        cachedLocalizations.map(async (localization: any) => {
          await this.getDefaultHeader(localization.path, true);
          await this.getDefaultFooter(localization.path, true);
        }),
      );
    } catch (error) {
      this.logger.error(`Error loading default headers and footers`, error.stack);
    }
  }  
}
