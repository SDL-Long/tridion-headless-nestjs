import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  HttpStatus,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { BaseService } from '../base.service';
import { TridionService } from '../../common/graphql/tridion.service';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import { Categories, Keyword, Parent } from '../interfaces/taxonomy.interface';
import {
  GET_ALL_CATEGORY_WITHOUT_KEYWORD,
  GET_ALL_CATEGORY_AND_KEYWORD,
  GET_SPECIFIC_CATEGORY_WITH_KEYWORD_BY_ID,
  GET_SPECIFIC_CATEGORY_WITH_KEYWORD_BY_NAME,
  GET_SPECIFIC_CATEGORY_WITHOUT_KEYWORD_BY_ID,
  GET_SPECIFIC_CATEGORY_WITHOUT_KEYWORD_BY_NAME,
  GET_SPECIFIC_KEYWORD,
  GET_SPECIFIC_CATEGORY_WITH_FIRST_LEVEL_KEYWORD_BY_ID,
  GET_SPECIFIC_CATEGORY_WITH_FIRST_LEVEL_KEYWORD_BY_NAME,
  GET_SPECIFIC_KEYWORD_WITH_FIRST_LEVLE_CHILDREN,
  GET_SPECIFIC_KEYWORD_WITHOUT_CHILDREN,
} from '../queries/taxonomy.query';
import { UtilsService } from '../../common/utils/utils.service';
// import { CronJob } from 'cron';

@Injectable()
export class TaxonomyService {
  constructor(
    private readonly baseService: BaseService,
    private readonly tridionService: TridionService,
    private readonly cachingService: CachingService,
    private readonly utilService: UtilsService,
    private readonly logger: Logger,
  ) {}

  SERVICE: string = TaxonomyService.name;

  async initialize(): Promise<void> {
    try {
      await this.loadTaxonomies();
      this.logger.log('Taxonomies cache initialized');
    } catch (error) {
      this.logger.error(
        `Initialization failed: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      throw new InternalServerErrorException('Failed to initialize taxonomies');
    }
  }

  // async initialize() {
  //   try {
  //     await this.loadTaxonomies();

  //     const baseInterval = this.utilService.getTaxonomyCacheTtlForCronJob();
  //     const jitter = Math.floor(Math.random() * 5 * 60 * 1000);
  //     const cronInterval = baseInterval + jitter;

  //     const cronExpression = this.utilService.convertMillisecondsToCron(cronInterval);

  //     new CronJob(cronExpression, async () => {
  //       try {
  //         await this.loadTaxonomies();
  //       } catch (error) {
  //         this.logger.error("Error during cron job execution", error.stack);
  //       }
  //     }).start();
  //   } catch (error) {
  //     this.logger.error(`Error in OnApplicationBootstrap`, error.stack, this.SERVICE);
  //     throw new InternalServerErrorException(`Error during OnApplicationBootstrap`);
  //   }
  // }

  async loadTaxonomies(): Promise<void> {
    let cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);
  
    if (!cachedLocalizations || cachedLocalizations.length === 0) {
      this.logger.warn(`Localization not found, try reload from CMS`);
      await this.baseService.loadLocalizations();
      cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);
  
      if (!cachedLocalizations || cachedLocalizations.length === 0) {
        this.logger.error(`Reload localization failed, skip taxonomy preload`);
        return;
      }
    }
  
    await Promise.all(
      cachedLocalizations.map(async (loc: any) => {
        try {
          const locale = this.baseService.normalizePath(loc.path);
          const pubId = await this.baseService.getPublicationIdByLocale(locale);
  
          await this.baseService.fetchAllCategoriesAndKeywords(pubId);
  
          this.logger.debug(`Taxonomy loaded for locale=${locale}`);
        } catch (e) {
          this.logger.error(
            `Failed to preload taxonomy for ${loc.path}`,
            e,
          );
        }
      }),
    );
  }

  async getAllCategoriesWithoutKeyword(localization: string): Promise<Categories> {
    this.logger.debug(
      `Fetching all categories without keyword for localization: ${localization}`,
      this.SERVICE,
    );

    try {
      const cachedCategoriesData = await this.cachingService.getFromCache(
        CacheTypes.CATEGORY,
        localization,
      );

      if (cachedCategoriesData) {
        return cachedCategoriesData as Categories;
      }

      const publicationId = await this.baseService.getPublicationIdByLocale(localization);

      const variables = {
        namespaceId: 1,
        publicationId: publicationId,
      };

      const response = await this.tridionService.query(GET_ALL_CATEGORY_WITHOUT_KEYWORD, variables);

      const categoriesData = response.data?.categories;

      if (!categoriesData || !categoriesData.edges || categoriesData.edges.length === 0) {
        throw new HttpException('No content returned', HttpStatus.NO_CONTENT);
      }

      const categories: Categories = {} as Categories;

      categories.categories = this.processNestedDataForCategory(categoriesData.edges);

      await this.cachingService.putIntoCache(CacheTypes.CATEGORY, {
        url: localization,
        payload: categories,
      });

      return categories;
    } catch (error) {
      this.logger.error(
        `Error fetching all categories without keyword: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      if (HttpStatus.NO_CONTENT === error.status || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  // A maximum of three layers of keyword can be fetched
  async getAllCategoriesWithKeywords(localization: string): Promise<Categories> {
    this.logger.debug(
      `Fetching all categories with keywords for localization: ${localization}`,
      this.SERVICE,
    );

    try {
      const cachedCategoriesData = await this.cachingService.getFromCache(
        CacheTypes.CATEGORYWITHKEYWORD,
        localization,
      );

      if (cachedCategoriesData) {
        return cachedCategoriesData as Categories;
      }

      const publicationId = await this.baseService.getPublicationIdByLocale(localization);

      const variables = {
        namespaceId: 1,
        publicationId: publicationId,
      };

      const response = await this.tridionService.query(GET_ALL_CATEGORY_AND_KEYWORD, variables);

      const categoriesData = response.data?.categories;

      if (!categoriesData || !categoriesData.edges || categoriesData.edges.length === 0) {
        throw new HttpException('No content returned', HttpStatus.NO_CONTENT);
      }

      const categories: Categories = {} as Categories;

      categories.categories = this.processNestedDataForCategoryAndKeyword(categoriesData.edges);

      await this.cachingService.putIntoCache(CacheTypes.CATEGORYWITHKEYWORD, {
        url: localization,
        payload: categories,
      });

      return categories;
    } catch (error) {
      this.logger.error(
        `Error fetching all categories with keywords: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      if (HttpStatus.NO_CONTENT === error.status || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  // A maximum of three layers of keyword can be fetched or it does not include keyword
  async getSpecificCategoryWithKeywordsByIdOrName(
    localization: string,
    categoryId: number,
    categoryName: string,
    includeChildren: boolean,
    flat: boolean,
  ): Promise<Keyword> {
    this.logger.debug(
      `Fetching specific category with keywords by ID or name for localization: ${localization}`,
      this.SERVICE,
    );

    if (!categoryId && !categoryName) {
      throw new BadRequestException('Either category name or id must be provided');
    }

    try {
      const cacheKey = this.generateCacheKey({
        localization,
        categoryId,
        categoryName,
        includeChildren,
        flat,
      });

      const cachedCategoryData = await this.cachingService.getFromCache(
        CacheTypes.CATEGORYWITHKEYWORD,
        cacheKey,
      );

      if (cachedCategoryData) {
        return cachedCategoryData as Keyword;
      }

      const publicationId = await this.baseService.getPublicationIdByLocale(localization);

      const variables: any = {
        namespaceId: 1,
        publicationId: publicationId,
      };

      let query: any;

      if (categoryId) {
        variables.categoryId = categoryId;
        query = includeChildren
          ? flat
            ? GET_SPECIFIC_CATEGORY_WITH_FIRST_LEVEL_KEYWORD_BY_ID
            : GET_SPECIFIC_CATEGORY_WITH_KEYWORD_BY_ID
          : GET_SPECIFIC_CATEGORY_WITHOUT_KEYWORD_BY_ID;
      } else {
        variables.categoryName = categoryName;
        query = includeChildren
          ? flat
            ? GET_SPECIFIC_CATEGORY_WITH_FIRST_LEVEL_KEYWORD_BY_NAME
            : GET_SPECIFIC_CATEGORY_WITH_KEYWORD_BY_NAME
          : GET_SPECIFIC_CATEGORY_WITHOUT_KEYWORD_BY_NAME;
      }

      const response = await this.tridionService.query(query, variables);

      const categoryData = response.data.category;

      if (!categoryData) {
        const identifier = categoryId ? `ID: ${categoryId}` : `Name: ${categoryName}`;
        throw new NotFoundException(`Category with ID or Name not found: ${identifier}`);
      }

      const categoryProps: Keyword = {
        itemId: categoryData.itemId,
        itemType: categoryData.itemType,
        description: categoryData.description,
        key: categoryData.key,
        title: categoryData.title,
        hasChildren: categoryData.hasChildren,
        customMetadata: this.baseService.processCustomMetadata(
          categoryData.customMetas?.edges || [],
        ),
        children: includeChildren
          ? this.processNestedDataForCategoryAndKeyword(categoryData.children?.edges)
          : [],
      };

      await this.cachingService.putIntoCache(CacheTypes.CATEGORYWITHKEYWORD, {
        url: cacheKey,
        payload: categoryProps,
      });

      return categoryProps;
    } catch (error) {
      this.logger.error(
        `Error fetching specific category with keywords: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  // A maximum of three layers of keyword can be fetched
  async getSpecificKeyword(
    localization: string,
    categoryId: number,
    keywordId: number,
    includeChildren: boolean,
    flat: boolean,
  ): Promise<Keyword> {
    this.logger.debug(`Fetching specific keyword for localization: ${localization}`, this.SERVICE);

    if (!categoryId || !keywordId) {
      throw new BadRequestException('The categoryId and keywordId must be provided');
    }

    try {
      const cacheKey = this.generateCacheKey({
        localization,
        categoryId,
        keywordId,
        includeChildren,
        flat,
      });

      const cachedKeywordData = await this.cachingService.getFromCache(
        CacheTypes.KEYWORD,
        cacheKey,
      );

      if (cachedKeywordData) {
        return cachedKeywordData as Keyword;
      }

      const publicationId = await this.baseService.getPublicationIdByLocale(localization);

      const variables = {
        namespaceId: 1,
        publicationId: publicationId,
        categoryId: categoryId,
        keywordId: keywordId,
      };

      const query = includeChildren
        ? flat
          ? GET_SPECIFIC_KEYWORD_WITH_FIRST_LEVLE_CHILDREN
          : GET_SPECIFIC_KEYWORD
        : GET_SPECIFIC_KEYWORD_WITHOUT_CHILDREN;

      const response = await this.tridionService.query(query, variables);

      const keywordData = response.data.keyword;

      if (!keywordData) {
        throw new NotFoundException(`Keyword is not found with ID : ${keywordId}`);
      }

      const keyword: Keyword = {
        itemId: keywordData.itemId,
        itemType: keywordData.itemType,
        description: keywordData.description,
        key: keywordData.key,
        title: keywordData.title,
        hasChildren: keywordData.hasChildren,
        customMetadata: this.baseService.processCustomMetadata(
          keywordData.customMetas?.edges || [],
        ),
        parent: keywordData.parent ? (keywordData.parent as Parent) : null,
        children: includeChildren
          ? this.processNestedDataForCategoryAndKeyword(keywordData.children?.edges)
          : [],
      };

      await this.cachingService.putIntoCache(CacheTypes.KEYWORD, {
        url: cacheKey,
        payload: keyword,
      });

      return keyword;
    } catch (error) {
      this.logger.error(
        `Error fetching specific keyword: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  processNestedDataForCategory(edges: any): Keyword[] {
    const data: Keyword[] = [];
    edges.forEach((edge: any) => {
      if (edge?.node) {
        const node = edge.node;
        const categoryData: Keyword = {
          itemId: node.itemId,
          itemType: node.itemType,
          description: node.description,
          key: node.key,
          title: node.title,
          hasChildren: node.hasChildren,
          customMetadata: this.baseService.processCustomMetadata(node.customMetas?.edges || []),
        };
        data.push(categoryData);
      }
    });

    return data;
  }

  processNestedDataForCategoryAndKeyword(edges: any[]): Keyword[] {
    const categories: Keyword[] = [];
    edges.forEach((edge: any) => {
      if (edge?.node) {
        const data = edge.node;
        const categoryData: Keyword = {
          itemId: data.itemId,
          itemType: data.itemType,
          description: data.description,
          key: data.key,
          title: data.title,
          hasChildren: data.hasChildren,
          customMetadata: this.baseService.processCustomMetadata(data.customMetas?.edges || []),
          parent: data.parent ? (data.parent as Parent) : null,
          children: this.processNestedDataForCategoryAndKeyword(data.children?.edges || []),
        };
        categories.push(categoryData);
      }
    });
    return categories;
  }

  private generateCacheKey(params: { [key: string]: any }): string {
    return JSON.stringify(params);
  }

  /* private generateCacheKey(
    localization: string,
    categoryId?: number,
    categoryName?: string,
    includeChildren?: boolean,
    flat?: boolean
  ): string {
    return `${localization}_${categoryId || 'none'}_${categoryName || 'none'}_${includeChildren ? 'true' : 'false'}_${flat ? 'true' : 'false'}`;
  } */
}
