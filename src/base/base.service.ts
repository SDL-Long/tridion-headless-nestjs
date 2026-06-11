import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ComponentTemplate, Content, CustomMetadata } from './interfaces/base.interface';
import { CachingService } from '../common/caching/caching.service';
import { CacheTypes } from '../common/enums/caching.enum';
import { TridionService } from '../common/graphql/tridion.service';
import {
  GET_BINARY_COMPONENT,
  GET_BINARY_COMPONENT_BY_ID,
  GET_BINARY_COMPONENT_BY_URL,
  GET_BINARY_COMPONENT_LAST_PUBLISH_DATE_BY_ID,
  GET_BINARY_COMPONENT_LAST_PUBLISH_DATE_BY_URL,
} from './queries/binary.query';
import { GET_COMPONENT_LINK, GET_COMPONENT_LINK2 } from './queries/link.query';
import * as cheerio from 'cheerio';
import { Element } from 'domhandler';
import { ComponentDto } from './dto/component.dto';
import { GET_COMPONENT, GET_COMPONENT_LIST, GET_COMPONENT_LIST2 } from './queries/component.query';
import { UtilsService } from '../common/utils/utils.service';
import { GET_ALL_PUBLICATION_MAPPINGS } from './queries/publication.query';
import { PublicationMapping } from './entities/publication-mapping.entity';
import * as CONSTANTS from '../constants';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Categories, Keyword, Parent } from './interfaces/taxonomy.interface';
import { GET_ALL_CATEGORY_AND_KEYWORD } from './queries/taxonomy.query';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BaseService {
  constructor(
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly cachingService: CachingService,
    private readonly tridionService: TridionService,
    private readonly utilService: UtilsService,
    private readonly httpService: HttpService,
  ) {}

  SERVICE: string = BaseService.name;

  async getBinaryComponentByUrl(publicationId: number, url: string): Promise<any> {
    this.logger.debug(`getBinaryComponentByUrl called with url: ${url}`, this.SERVICE);

    const variables = {
      namespaceId: 1,
      publicationId: publicationId,
      url: url,
    };

    const response = await this.tridionService.query(GET_BINARY_COMPONENT_BY_URL, variables);

    return response.data;
  }

  async getBinaryComponentByCmUri(cmUri: string): Promise<any> {
    this.logger.debug(`getBinaryComponentByCmUri called with cmUri: ${cmUri}`, this.SERVICE);

    const variables = {
      namespaceId: 1,
      cmUri: cmUri,
    };

    const response = await this.tridionService.query(GET_BINARY_COMPONENT, variables);

    return response.data;
  }

  async getBinaryComponentById(publicationId: number, binaryId: number): Promise<any> {
    this.logger.debug(
      `getBinaryComponentById called with publicationId: ${publicationId}, binaryId: ${binaryId}`,
      this.SERVICE,
    );

    const variables = {
      namespaceId: 1,
      publicationId: publicationId,
      binaryId: binaryId,
    };

    const response = await this.tridionService.query(GET_BINARY_COMPONENT_BY_ID, variables);

    return response.data;
  }

  async getBinaryComponentLastPublishDateByUrl(publicationId: number, url: string): Promise<any> {
    this.logger.debug(`getBinaryComponentLastPublishDate called with url: ${url}`, this.SERVICE);

    const variables = {
      namespaceId: 1,
      publicationId: publicationId,
      url: url,
    };

    const response = await this.tridionService.query(
      GET_BINARY_COMPONENT_LAST_PUBLISH_DATE_BY_URL,
      variables,
    );

    return response.data;
  }

  async getBinaryComponentLastPublishDateById(
    publicationId: number,
    binaryId: number,
  ): Promise<any> {
    this.logger.debug(
      `getBinaryComponentLastPublishDate called with binaryId: ${binaryId}`,
      this.SERVICE,
    );

    const variables = {
      namespaceId: 1,
      publicationId: publicationId,
      binaryId: binaryId,
    };

    const response = await this.tridionService.query(
      GET_BINARY_COMPONENT_LAST_PUBLISH_DATE_BY_ID,
      variables,
    );

    return response.data;
  }

  // To be removed
  async resolveComponentLink2(
    publicationId: number,
    pageId: number,
    compId: number,
  ): Promise<string> {
    const variables = {
      namespaceId: 1,
      publicationId: publicationId,
      sourcePageId: pageId,
      targetComponentId: compId,
    };

    const response = await this.tridionService.query(GET_COMPONENT_LINK2, variables);

    return response.data.componentLink.url;
  }

  async resolveComponentLink(
    publicationId: number,
    componentId: number,
  ): Promise<{ 
    url: string | null; 
    isBinary: boolean;
    isEcl?: boolean;
  }> {
    this.logger.debug(
      `resolveComponentLink called with publicationId: ${publicationId}, componentId: ${componentId}`,
      this.SERVICE,
    );
  
    const variables = {
      namespaceId: 1,
      publicationId,
      componentId,
    };
  
    const response = await this.tridionService.query(GET_COMPONENT_LINK, variables);
  
    const component = response?.data?.component;
    const isEcl = component.title && this.isEclType(component.title);
    const isBinary = component.content === null;

    let url = component.resolvedLink?.url
      ? component.resolvedLink.url
        .replace(/\.html(?=[?#]|$)/gi, '')
        .replace(/\/index(?=[?#]|$)/gi, '')
      : null;

    if (isEcl) {
      const s3Url = this.generateS3UrlFromEclTitle(component.title);
      if (s3Url) {
        url = s3Url;
      }
    }

    this.logger.debug(
      `Resolved component link: isBinary=${isBinary}, isEcl=${isEcl}, url=${url}`,
      this.SERVICE,
    );

    return {
      url,
      isBinary,
      isEcl,
    };
  }

  private isStringArrayType(value: any): boolean {
    return value?.$type == 'String[]';
  }

  private isArrayWithObjects(value: any): boolean {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object';
  }

  private isLinkType(value: any): boolean {
    return value?.id && (value?.$type == 'Link' || /^tcm:.*-.*$/.test(value.id));
  }

  private isLinkTypeForCustomMetadata(value: any): boolean {
    return value && (/^tcm:.*-.*$/.test(value));
  }

  private isEclType(value: any): boolean {
    if (typeof value === 'string') {
      return value.startsWith('ecl:');
    }
    
    if (value && typeof value === 'object') {
      return value.title && typeof value.title === 'string' && value.title.startsWith('ecl:');
    }
    
    return false;
  }

  private generateS3UrlFromEclTitle(eclTitle: string): string | null {
    if (!eclTitle || !this.isEclType(eclTitle)) {
      return null;
    }
  
    try {
      const fileId = this.extractS3FileId(eclTitle);
      if (!fileId) {
        return null;
      }
      
      const decodedFileId = this.replaceAndDecode(fileId);
      const s3BucketDomainUrl = this.configService.get<string>('s3BucketUrl');
      return s3BucketDomainUrl + decodedFileId;
    } catch (error) {
      this.logger.error(`Failed to generate S3 URL from ECL title: ${eclTitle}`, error, this.SERVICE);
      return null;
    }
  }

  private extractIdsFromUri(uri: string | string[]): number[] {
    // If uri is an array, process each string in the array
    if (Array.isArray(uri)) {
      return uri.flatMap((singleUri) => this.extractIdsFromUri(singleUri));
    }
  
    // If uri is a single string, process it
    return uri
      .split(/:|-/) // Split by ':' or '-'
      .filter((str) => !isNaN(parseInt(str))) // Filter out non-numeric parts
      .map(Number); // Convert to numbers
  }

  async processNestedFields(fields: any, targetObject: Content, pageId: number = 1): Promise<void> {
    if (!fields || typeof fields !== 'object') {
      return;
    }

    for (const key of Object.keys(fields)) {
      const value = fields[key];
      if (value && typeof value === 'object') {
        await this.processObjectField(key, value, targetObject);
      } else {
        targetObject[key] = await this.resolveRichtext(value);
      }
    }
  }

  private async processObjectField(key: string, value: any, targetObject: Content): Promise<void> {
    if (this.isStringArrayType(value)) {
      const processedValues = await Promise.all(
        value?.$values?.map(async (item: any) => {
          if (typeof item === 'string') {
            return await this.resolveRichtext(item);
          }
          return item;
        }) || []
      );

      targetObject[key] = {
        ...value,
        $values: processedValues
      };
    } else if (this.isArrayWithObjects(value)) {
      targetObject[key] = await this.processArrayField(value);
    } else {
      await this.processComplexField(value, (targetObject[key] = {}));
    }
  }

  private async processArrayField(arrayValue: any[]): Promise<Content[]> {
    return Promise.all(
      arrayValue.map(async item => {
        const nestedObject: Content = {};
        if (!item?.$type && item?.id && item.id.startsWith('tcm:')) {
          await this.processComplexField(item, nestedObject);
        } else {
          await this.processNestedFields(item, nestedObject);
        }

        return nestedObject;
      }),
    );
  }

  private async processComplexField(value: any, targetObject: Content): Promise<void> {
    if (this.isLinkType(value)) {
      const cmUri = value['id'];
      const [pubId, compId, itemType] = this.extractIdsFromUri(cmUri);
  
      if (itemType === 1024) {
        // process referenced category and keywords
        const { categories } = await this.fetchAllCategoriesAndKeywords(pubId);
  
        // find the matching keyword by ID
        const matchingKeywordData = this.findKeywordById(categories, compId, itemType);
  
        if (matchingKeywordData) {
          const newValue = {
            ...value,
            keywordData: matchingKeywordData,
          };
          await this.processNestedFields(newValue, targetObject);
        } else {
          console.warn(`Keyword with id ${value['id']} not found.`);
          await this.processNestedFields(value, targetObject);
        }
      } else {
        // All component links include ECL、binary、normal component
        await this.processComponentLink(pubId, compId, cmUri, value, targetObject);
      }
    } else {
      await this.processNestedFields(value, targetObject);
    }
  }

  private async processComponentLink(
    pubId: number,
    compId: number,
    cmUri: string,
    value: any,
    targetObject: Content,
  ): Promise<void> {
    const compData = await this.getComponent(pubId, compId);
    
    if (compData?.title && this.isEclType(compData.title)) {
      const s3Url = this.generateS3UrlFromEclTitle(compData.title);
      if (s3Url) {
        const newValue = {
          ...value,
          s3Url,
        };
        await this.processNestedFields(newValue, targetObject);
        return;
      }
    } else if (compData == null || compData.content == null) {
      await this.processMultimediaComponentLink(value, cmUri, targetObject);
    } else {
      // process linked component
      const { url } = await this.resolveComponentLink(pubId, compId);
      const componentTemplate: ComponentTemplate = {} as ComponentTemplate;
      const compTemplateENV = 'c' + compData.schemaId;
      componentTemplate.view = this.utilService.getComponentTemplate(compTemplateENV);
      
      const newValue = {
        ...value,
        schemaId: compData.schemaId,
        componentTemplate: componentTemplate,
        linkedUrl: url,
        linkedData: compData.content?.data,
        linkedCustomMetadata: this.processCustomMetadata(compData.customMetas?.edges || []),
      };
      await this.processNestedFields(newValue, targetObject);
    }
  }

  private async processMultimediaComponentLink(
    value: any,
    cmUri: string,
    targetObject: Content,
  ): Promise<void> {
    const binaryData = await this.getBinaryComponentByCmUri(cmUri);

    if (binaryData && binaryData.binaryComponent) {
      // make the binary url unique
      const binaryComponentData = this.modifyBinaryResponse(binaryData.binaryComponent, cmUri);
      const newProperty = binaryComponentData?.variants;
      const newPropertyMeta = binaryComponentData?.customMetas;
      const newValue = {
        ...value,
        variants: newProperty,
        customMetas: this.processCustomMetadata(newPropertyMeta?.edges || []),
      };

      await this.processNestedFields(newValue, targetObject);
    } else {
      await this.processNestedFields(value, targetObject);
    }
  }

  processCustomMetadata(customMetaEdges: any): CustomMetadata {
    const customMeta: CustomMetadata = {};

    if (customMetaEdges && customMetaEdges.length > 0) {
      customMetaEdges.reduce((acc: CustomMetadata, edge: any) => {
          if (edge?.node?.key && edge?.node?.value) {
              const key = edge.node.key;
              const value = edge.node.value;

              if (acc[key] === undefined) {
                  acc[key] = value;
              } else if (Array.isArray(acc[key])) {
                  if (!acc[key].includes(value)) {
                      acc[key].push(value);
                  }
              } else {
                  if (acc[key] !== value) {
                      acc[key] = [acc[key], value];
                  }
              }
          }
          return acc;
      }, customMeta);
    }

    return customMeta;
  }

  // For the types of metadata fields: component link, multimedia link, etc.
  async processCustomMetadataAsyncForCategoryAndKeyword(customMeta: any): Promise<CustomMetadata> {
    if (!customMeta || typeof customMeta !== 'object') {
        return {} as CustomMetadata;
    }

    const processedMetadata: CustomMetadata = {};

    for (const key of Object.keys(customMeta)) {
        const value = customMeta[key];

        if (Array.isArray(value)) {
            processedMetadata[key] = await Promise.all(
                value.map(item => this.processLinkedComponentForCategoryAndKeyword(item))
            );
        } else {
            processedMetadata[key] = await this.processLinkedComponentForCategoryAndKeyword(value);
        }
    }

    return processedMetadata;
  }

  // For the types of metadata fields: component link, multimedia link, etc.
  async processCustomMetadataAsync(customMetaEdges: any): Promise<CustomMetadata> {
    const customMeta: CustomMetadata = {};
    const processedCustomMeta: CustomMetadata = {};

    if (customMetaEdges && customMetaEdges.length > 0) {
      customMetaEdges.reduce((acc: CustomMetadata, edge: any) => {
          if (edge?.node?.key && edge?.node?.value) {
              const key = edge.node.key;
              const value = edge.node.value;

              if (acc[key] === undefined) {
                  acc[key] = value;
              } else if (Array.isArray(acc[key])) {
                  if (!acc[key].includes(value)) {
                      acc[key].push(value);
                  }
              } else {
                  if (acc[key] !== value) {
                      acc[key] = [acc[key], value];
                  }
              }
          }
          return acc;
      }, customMeta);
    }

    await this.processNestedFieldsForCustomMetadata(customMeta, processedCustomMeta);

    return processedCustomMeta;
  }

  async processNestedFieldsForCustomMetadata(fields: any, targetObject: Content): Promise<void> {
    if (!fields || typeof fields !== 'object') {
      return;
    }

    for (const key of Object.keys(fields)) {
      const value = fields[key];

      if (Array.isArray(value)) {
        targetObject[key] = [];
        for (const item of value) {
          targetObject[key].push(await this.processlinkedComponentForMetadata(item));
        }
      } else {
        targetObject[key] = await this.processlinkedComponentForMetadata(value);
      }
    }
  }

  async processlinkedComponentForMetadata(value: any): Promise<any> {
    if (this.isLinkTypeForCustomMetadata(value)) {
        const [pubId, compId, itemType] = this.extractIdsFromUri(value);
        const compData = await this.getComponent(pubId, compId);
        
        if (compData?.title && this.isEclType(compData.title)) {
          const s3Url = this.generateS3UrlFromEclTitle(compData.title);
          if (s3Url) {
            return s3Url;
          }
        } else if (compData == null || compData.content == null) {
          // Process multimedia link component
          const binaryData = await this.getBinaryComponentByCmUri(value);

          if (binaryData && binaryData.binaryComponent) {
            const binaryComponentData = this.modifyBinaryResponse(binaryData.binaryComponent, value);
            return binaryComponentData?.variants?.edges?.[0]?.node?.url;
          }
        } else {
          // Process linked component
          const { url } = await this.resolveComponentLink(pubId, compId);
          const componentTemplate: ComponentTemplate = {} as ComponentTemplate;
          const compTemplateENV = 'c' + compData.schemaId;
          componentTemplate.view = this.utilService.getComponentTemplate(compTemplateENV);
          const newProperty = {
            linkedUrl: url,
            schemaId: compData.schemaId,
            componentTemplate: componentTemplate,
            linkedData: compData.content?.data,
            linkedCustomMetadata: this.processCustomMetadata(compData.customMetas?.edges || []),
          };

          const newTargetObject: Content = {} as Content;
          await this.processNestedFields(newProperty, newTargetObject);
          return newTargetObject;
        }
    } else {
        return value;
    }
  }

  async processLinkedComponentForCategoryAndKeyword(value: any): Promise<any> {
    if (this.isLinkTypeForCustomMetadata(value)) {
        const [pubId, compId, itemType] = this.extractIdsFromUri(value);
        const compData = await this.getComponent(pubId, compId);

        if (itemType === 1024) {
          // process referenced category and keywords
          const { categories } = await this.fetchAllCategoriesAndKeywords(pubId);
  
          // find the matching keyword by ID
          const matchingKeywordData = this.findKeywordById(categories, compId, itemType);
  
          return matchingKeywordData;
        } else if (compData?.title && this.isEclType(compData.title)) {
          const s3Url = this.generateS3UrlFromEclTitle(compData.title);
          if (s3Url) {
            return s3Url;
          }
        } else if (compData == null || compData.content == null) {
          // Process multimedia link component
          const binaryData = await this.getBinaryComponentByCmUri(value);

          if (binaryData && binaryData.binaryComponent) {
            const binaryComponentData = this.modifyBinaryResponse(binaryData.binaryComponent, value);
            return binaryComponentData?.variants?.edges?.[0]?.node?.url;
          }
        } else {
          // Process linked component
          const { url } = await this.resolveComponentLink(pubId, compId);
          return url;
        }
    } else {
        return value;
    }
  }

  async processAllCustomMetadataForCategoryAndKeyword(categories: Keyword[]): Promise<void> {
    for (const category of categories) {
        category.customMetadata = await this.processCustomMetadataAsyncForCategoryAndKeyword(category.customMetadata);

        if (category.children?.length > 0) {
            await this.processAllCustomMetadataForCategoryAndKeyword(category.children);
        }
    }
  }

  async fetchAllCategoriesAndKeywords(pubId: number): Promise<Categories> {
    this.logger.debug(
      `Fetching all categories with keywords for publication Id: ${pubId}`,
      this.SERVICE,
    );

    const locale = await this.getLocaleByPublicationId(pubId);

    try {
      const cachedCategoriesData = await this.cachingService.getFromCache(
        CacheTypes.CATEGORYWITHKEYWORD,
        locale,
      );

      if (cachedCategoriesData) {
        return cachedCategoriesData as Categories;
      }

      const variables = {
        namespaceId: 1,
        publicationId: pubId,
      };

      const response = await this.tridionService.query(GET_ALL_CATEGORY_AND_KEYWORD, variables);

      const categoriesData = response.data?.categories;

      if (!categoriesData || !categoriesData.edges || categoriesData.edges.length === 0) {
        throw new HttpException('No content returned', HttpStatus.NO_CONTENT);
      }

      const categories: Categories = {} as Categories;

      // Get all the data and suspend processing of the link component in the keyword
      categories.categories = await this.processNestedDataForCategoryAndKeyword(categoriesData.edges);

      // Avoid infinite loop
      await this.cachingService.putIntoCache(CacheTypes.CATEGORYWITHKEYWORD, {
        url: locale,
        payload: categories,
      });

      // Process link component
      await this.processAllCustomMetadataForCategoryAndKeyword(categories.categories);

      // Update Cache
      await this.cachingService.putIntoCache(CacheTypes.CATEGORYWITHKEYWORD, {
        url: locale,
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

  async processNestedDataForCategoryAndKeyword(edges: any[]): Promise<Keyword[]> {
    const categories: Keyword[] = await Promise.all(
      edges.map(async (edge: any) => {
        if (edge?.node) {
          const data = edge.node;
          return {
            itemId: data.itemId,
            itemType: data.itemType,
            description: data.description,
            key: data.key,
            title: data.title,
            hasChildren: data.hasChildren,
            customMetadata: this.processCustomMetadata(data.customMetas?.edges || []),
            parent: data.parent ? (data.parent as Parent) : null,
            children: await this.processNestedDataForCategoryAndKeyword(data.children?.edges || []),
          } as Keyword;
        }
        return null;
      })
    );

    return categories.filter(Boolean);
  }

  private findKeywordById(categories: any[], keywordId: number, itemType: number): any | null {
    for (const category of categories) {
      if (category.itemType === itemType && category.itemId === keywordId) {
        return category;
      }

      if (category.hasChildren && category.children?.length > 0) {
        const result = this.findKeywordById(category.children, keywordId, itemType);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  // process component data included in Page
  async getComponent(publicationId: number, componentId: number): Promise<any> {
    const variables = {
      namespaceId: 1,
      publicationId: publicationId,
      componentId: componentId,
    };

    const response = await this.tridionService.query(GET_COMPONENT, variables);

    return response.data.component;
  }

  modifyBinaryResponse(binaryComponentData: any, cmUri: string): any {
    const edges = binaryComponentData?.variants?.edges;

    if (edges && Array.isArray(edges)) {
      return {
        ...binaryComponentData,
        variants: {
          ...binaryComponentData.variants,
          edges: edges.map(edge => {
            const node = { ...edge.node };
            if (node.url) {
              const modifiedCmUri = cmUri.replace(':', '');
              const [path, query] = node.url.split('?');
              const lastDotIndex = path.lastIndexOf('.');
              node.url =
                lastDotIndex !== -1
                  ? `${path.slice(0, lastDotIndex)}_${modifiedCmUri}${path.slice(lastDotIndex)}`
                  : `${path}_${modifiedCmUri}`;

              if (query) {
                node.url += `?${query}`;
              }
            }
            return { ...edge, node };
          }),
        },
      };
    }

    return binaryComponentData;
  }

  // modifyBinaryResponse(binaryComponentData: any, cmUri: string): any {
  //   const edges = binaryComponentData?.variants?.edges; // JSON.parse(JSON.stringify(...))

  //   if (edges && Array.isArray(edges)) {
  //     edges.forEach(edge => {
  //       const node = edge?.node;
  //       if (node && node.url) {
  //         const modifiedCmUri = cmUri.replace(":", "");

  //         // split the URL into path and query components
  //         const [path, query] = node.url.split('?');

  //         // find the last occurrence of "." in the path to insert the modified cmUri
  //         const lastDotIndex = path.lastIndexOf(".");

  //         if (lastDotIndex !== -1) {
  //           // insert the modifiedCmUri before the file extension
  //           node.url = path.slice(0, lastDotIndex) + `_${modifiedCmUri}` + path.slice(lastDotIndex);

  //           if (query) {
  //             node.url += `?${query}`;
  //           }
  //         } else {
  //           node.url = `${path}_${modifiedCmUri}`;
  //         }
  //       }
  //     });
  //   }

  //   return binaryComponentData;
  // }

  extractBinaryIdFromUrl(url: string): number | null {
    const regex = /_tcm\d+-(\d+)\.\w+$/;
    const match = url.match(regex);

    if (match) {
      return Number(match[1]);
    } else {
      this.logger.error(`BinaryId is not found for URL: ${url}`);
      throw new NotFoundException(`BinaryId is not found for URL: ${url}`);
    }
  }

  async getPublicationIdByLocale(locale: string): Promise<number> {
    const { publicationId } = await this.resolveLocalization(locale);

    return publicationId;
  }

  async getLocaleByPublicationId(publicationId: number): Promise<string> {
    const cachedLocalizations: Array<PublicationMapping> = await this.cachingService.getFromCache(
      CacheTypes.LOCALIZATION,
    );

    if (!cachedLocalizations) {
      throw new NotFoundException(CONSTANTS.ERROR_LOCALIZATIONS_NOT_FOUND);
    }

    // Find the localization that matches the given publicationId
    const matchingLocalization = cachedLocalizations.find(
      mapping => mapping.publicationId === publicationId,
    );

    if (!matchingLocalization) {
      throw new BadRequestException(`Publication ID ${publicationId} not found.`);
    }

    // Extract and return the locale from the path
    return this.normalizePath(matchingLocalization.path);
  }

  async resolveLocalization(uri: string): Promise<{ publicationId: number; locale: string }> {
    this.logger.debug(`resolveLocalization called with uri: ${uri}`, this.SERVICE);

    try {
      const cachedLocalizations: Array<PublicationMapping> = await this.cachingService.getFromCache(
        CacheTypes.LOCALIZATION,
      );

      if (cachedLocalizations == null) {
        throw new NotFoundException(CONSTANTS.ERROR_LOCALIZATIONS_NOT_FOUND);
      }

      // prefix with '/'
      const normalizedUri = this.ensureLeadingSlash(uri);

      const siteDomain = this.utilService.getSiteDomain();
      const sitePort = this.utilService.getSitePort();
      const siteProtocol = this.utilService.getSiteProtocol();

      const matchingMappings = cachedLocalizations.filter(
        mapping =>
          (normalizedUri === mapping.path ||
            normalizedUri.startsWith(mapping.path + '/')) &&
          // normalizedUri.startsWith(mapping.path) &&
          mapping.domain === siteDomain &&
          mapping.port === sitePort &&
          mapping.protocol === siteProtocol,
      );

      // throw exception when locale is not found in Publications Mapping
      if (matchingMappings == null || matchingMappings.length === 0) {
        throw new BadRequestException('Uri ' + uri + ' is incorrect.');
      }

      const bestMatch = matchingMappings.reduce((prev, current) => {
        return prev.path.length >= current.path.length ? prev : current;
      });

      const publicationId = bestMatch.publicationId;
      const locale = bestMatch.path.replace(/^\/+/, '');

      if (!publicationId) {
        throw new NotFoundException(CONSTANTS.ERROR_LOCALIZATION_NOT_FOUND);
      }

      return { publicationId, locale };
    } catch (error) {
      throw error;
    }
  }

  getComponentId(url: string): number {
    this.logger.debug(`getComponentId called with url: ${url}`, this.SERVICE);

    const parts = url.split('/');

    if (parts.length < 1) {
      throw new BadRequestException(`Invalid URL format: ${url}`);
    }

    const idString = parts[parts.length - 1];
    const componentId = Number(idString);

    return componentId;
  }

  public normalizePath(path: string): string {
    return path.replace(/^\/+/, '').toLowerCase();
  }

  normalizeUrl(url: string): string {
    let normalizedUrl = this.ensureLeadingSlash(url);

    normalizedUrl = this.ensureHtmlExtension(normalizedUrl);

    const parsedUrl = new URL(normalizedUrl, 'https://dummy');

    // remove ending slash
    if (parsedUrl.pathname !== '/' && parsedUrl.pathname.endsWith('/')) {
      parsedUrl.pathname = parsedUrl.pathname.slice(0, -1);
    }

    // remove redundant `.`, `..`
    const parts = parsedUrl.pathname.split('/').filter(part => part !== '.' && part !== '..');
    parsedUrl.pathname = parts.join('/');

    return parsedUrl.pathname + (parsedUrl.search ? '?' + parsedUrl.search : '');
  }

  ensureLeadingSlash(url: string): string {
    return url.startsWith('/') ? url : `/${url}`;
  }

  ensureHtmlExtension(url: string): string {
    return !url.endsWith(CONSTANTS.DefaultExtension) && !url.endsWith('.json')
      ? `${url}${CONSTANTS.DefaultExtension}`
      : url;
  }

  urlPartialPathEncode(url: string): string {
    if (!url) return url;

    let encodedUrl = '';

    for (const char of url) {
      switch (char) {
        case ' ':
          encodedUrl += '%20';
          break;
        case '!':
          encodedUrl += '%21';
          break;
        case '"':
          encodedUrl += '%22';
          break;
        case '#':
          encodedUrl += '%23';
          break;
        case '$':
          encodedUrl += '%24';
          break;
        case '&':
          encodedUrl += '%26';
          break;
        case "'":
          encodedUrl += '%27';
          break;
        case '(':
          encodedUrl += '%28';
          break;
        case ')':
          encodedUrl += '%29';
          break;
        case '*':
          encodedUrl += '%2A';
          break;
        case '+':
          encodedUrl += '%2B';
          break;
        case ',':
          encodedUrl += '%2C';
          break;
        case ':':
          encodedUrl += '%3A';
          break;
        case ';':
          encodedUrl += '%3B';
          break;
        case '<':
          encodedUrl += '%3C';
          break;
        case '=':
          encodedUrl += '%3D';
          break;
        case '>':
          encodedUrl += '%3E';
          break;
        case '?':
          encodedUrl += '%3F';
          break;
        case '@':
          encodedUrl += '%40';
          break;
        case '[':
          encodedUrl += '%5B';
          break;
        case ']':
          encodedUrl += '%5D';
          break;
        case '^':
          encodedUrl += '%5E';
          break;
        case '{':
          encodedUrl += '%7B';
          break;
        case '|':
          encodedUrl += '%7C';
          break;
        case '}':
          encodedUrl += '%7D';
          break;
        case '/':
          encodedUrl += '/';
          break;
        default:
          encodedUrl += char;
          break;
      }
    }

    return encodedUrl;
  }

  async resolveRichtext(content: string): Promise<string> {
    if (!this.containsHtml(content)) {
      return content;
    }

    const $ = cheerio.load(content, {
      xmlMode: true, // XML schema to handle tcdl:Link
      decodeEntities: false
    });

    const apiBaseUrl = this.configService.get<string>('SHARED_API_URL');
    const elementsToUpdate: cheerio.Cheerio<Element> = $('tcdl\\:Link');

    await Promise.all(
      elementsToUpdate.map(async (index, element) => {
        const type = $(element).attr('type');
        const destination = $(element).attr('destination');
        const linkAttributes = $(element).attr('linkAttributes');
        const attributes = this.parseAttributes(linkAttributes);

        if (type === 'Binary') {
          const binaryData = await this.getBinaryComponentByCmUri(destination);
          
          let s3Url = null;
          let altText = '';
          
          if (binaryData?.binaryComponent?.title && this.isEclType(binaryData.binaryComponent.title)) {
            s3Url = this.generateS3UrlFromEclTitle(binaryData.binaryComponent.title);
          }
          
          if (!s3Url && (!binaryData || !binaryData.binaryComponent)) {
            try {
              const ids = destination
                .split(/:|-/)
                .filter(str => !isNaN(parseInt(str)))
                .map(Number);
              const [pubId, compId] = ids;
              
              const componentData = await this.getComponent(pubId, compId);
              if (componentData?.title && this.isEclType(componentData.title)) {
                s3Url = this.generateS3UrlFromEclTitle(componentData.title);
              }
            } catch (error) {
              console.error(`Failed to process ECL component:`, error);
            }
          }
        
          if (s3Url) {
            altText = attributes['alt'] || '';
            const imgTag = `<img src="${s3Url}" alt="${altText}" ${this.convertAttributesToString(attributes)} />`;
            $(element).replaceWith(imgTag);
            return;
          }
        
          let imageUrl = '';
        
          if (binaryData && binaryData.binaryComponent) {
            const binaryComponentData = this.modifyBinaryResponse(
              binaryData.binaryComponent,
              destination,
            );
        
            binaryComponentData?.variants?.edges.map((currentImage: any) => {
              const imageItem = currentImage.node;
              imageUrl = `${apiBaseUrl}${imageItem?.url}`;
            });
        
            const customMetas = binaryComponentData?.customMetas?.edges || [];
            const altMeta = customMetas.find((meta: any) => meta?.node?.key === 'altText');
            altText = altMeta?.node?.value || '';
          }
        
          const imgTag = `<img src="${imageUrl}" alt="${altText}" ${this.convertAttributesToString(attributes)} />`;
          
          $(element).replaceWith(imgTag);

        } else if (type === 'Component') {
          const text = $(element).text();
          
          // Component Link
          const ids = destination
            .split(/:|-/)
            .filter(str => !isNaN(parseInt(str)))
            .map(Number);
          const [pubId, compId] = ids;

          const { url: pageUrl, isBinary, isEcl } = await this.resolveComponentLink(pubId, compId);

          let finalUrl: string | null = null;

          // 1. ECL component
          if (isEcl && pageUrl) {
            finalUrl = pageUrl;
          }
          // 2. normal component
          else if (!isBinary && pageUrl) {
            finalUrl = pageUrl;
          }
          // 3. binary
          else if (isBinary && !isEcl) {
            const binaryData = await this.getBinaryComponentByCmUri(destination);

            if (binaryData?.binaryComponent) {
              const binaryComponentData = this.modifyBinaryResponse(
                binaryData.binaryComponent,
                destination,
              );

              const edge = binaryComponentData?.variants?.edges?.[0];
              const binaryRelativeUrl = edge?.node?.url;

              if (binaryRelativeUrl) {
                finalUrl = `${apiBaseUrl}${binaryRelativeUrl}`;
              }
            }
          }

          // Render or fallback
          if (finalUrl) {
            const aTag = `<a href="${finalUrl}" ${this.convertAttributesToString(attributes)}>${text}</a>`;
            $(element).replaceWith(aTag);
            return;
          }

          this.logger.warn(
            `Unable to resolve component link in richtext: ${destination}`,
            this.SERVICE,
          );

          $(element).replaceWith(text);
        }
      }),
    );

    return $.html();
  }

  private containsHtml(str: string): boolean {
    const htmlRegex = /<[^>]*>/;
    return htmlRegex.test(str);
  }

  private parseAttributes(attributes: string): { [key: string]: string } {
    const attributesDict: { [key: string]: string } = {};
    if (!attributes) return attributesDict;
  
    try {
      const decodedAttributes = attributes
        .replace(/&amp;quot;/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
  
      const parts = decodedAttributes.split(/\s+(?=\w+=)/);
      
      const excludedTcdlAttributes = new Set([
        'textonfail', 'addanchor', 'variantid', 'xmlns:tcdl', 'tcdl:tag'
      ]);
  
      for (const part of parts) {
        const equalsIndex = part.indexOf('=');
        if (equalsIndex === -1) continue;
        
        const key = part.slice(0, equalsIndex).trim();
        let value = part.slice(equalsIndex + 1).trim();
        
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        const lowerKey = key.toLowerCase();
        if (value && !excludedTcdlAttributes.has(lowerKey) && !lowerKey.startsWith('tcdl:')) {
          attributesDict[key] = value;
        }
      }
      
      return attributesDict;
    } catch (error) {
      console.error('Error parsing attributes:', error);
      return {};
    }
  }

  private convertAttributesToString(attributes: { [key: string]: string }): string {
    if (!attributes || Object.keys(attributes).length === 0) {
      return '';
    }
    
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${this.escapeHtmlAttribute(value)}"`)
      .join(' ');
  }
  
  private escapeHtmlAttribute(value: string): string {
    return value
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async getComponentList(compDto: ComponentDto): Promise<any> {
    this.logger.debug(
      `getComponentList called with compDto: ${JSON.stringify(compDto)}`,
      this.SERVICE,
    );

    const { locale, id, title, type } = compDto;

    try {
      if (!id && !title && !type) {
        throw new BadRequestException('Either id, title, or type must be provided');
      }

      const locales = locale.split(',').filter(loc => loc.trim() !== '');

      const publicationIds = await Promise.all(
        locales.map(loc => this.getPublicationIdByLocale(loc)),
      );

      const variables = {
        namespaceId: 1,
        publicationIds: publicationIds,
      };

      let response: any;

      if (id || title) {
        variables['schema'] = id ? { id } : { title };
        response = await this.tridionService.query(GET_COMPONENT_LIST2, variables);
      } else if (type) {
        const itemTypes = type.split(',');
        variables['itemTypes'] = itemTypes;
        response = await this.tridionService.query(GET_COMPONENT_LIST, variables);
      }

      return response;
    } catch (error) {
      this.logger.error(`Error fetching label list: ${error.message}`, error.stack, this.SERVICE);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async clearCacheByType(type: string, url?: string): Promise<string> {
    const message = await this.cachingService.reset(type, url);

    if (type == CacheTypes.LOCALIZATION || type == CacheTypes.ALL) {
      await this.loadLocalizations();
    }

    return message;
  }

  async initialize() {
    await this.loadLocalizations();
  }

  async loadLocalizations(): Promise<void> {
    // load localizations for all publications and cache them
    // check for localization object in cache
    this.logger.debug(`loadLocalizations called`, this.SERVICE);

    const Site_Domain = this.utilService.getSiteDomain();
    const Site_Protocol = this.utilService.getSiteProtocol();
    const Site_Port = this.utilService.getSitePort();

    const variables = {
      namespaceId: 1,
    };

    const response = await this.tridionService.query(GET_ALL_PUBLICATION_MAPPINGS, variables);

    let pubsData = [];

    await Promise.all(
      response.data.publicationMappings.edges.map(async (currentLocalization: any) => {
        if (
          currentLocalization.node.domain == Site_Domain &&
          currentLocalization.node.protocol == Site_Protocol &&
          currentLocalization.node.port == Site_Port
        ) {
          const n = currentLocalization.node;
          pubsData.push(new PublicationMapping(n));
        }
      }),
    );

    // Using regex pattern
    pubsData = pubsData.filter(item => {
      // Regex to match the root path "/" or paths like: /tw/zh, /hk/en, /nz/en
      // This matches the root publication, or up to 2 segments where each is 2-3 lowercase letters
      const validLocalizationRegex = /^\/$|^\/[a-z]{2,3}(?:-[a-z]{2,3})?(?:\/[a-z]{2,3}(?:-[a-z]{2,3})?)?$/;
      
      return validLocalizationRegex.test(item.path);
    });

    await this.cachingService.putIntoCache(CacheTypes.LOCALIZATION, {
      payload: pubsData,
    });
  }

  async checkExternalService(): Promise<string> {
    const discoveryUri = this.utilService.getDiscoveryServiceUri();

    if (!discoveryUri) {
      throw new Error(CONSTANTS.MSG_DISCOVERY_URI_NOT_DEFINED);
    }

    try {
      const res = await firstValueFrom(
        this.httpService.get(`${discoveryUri}/health`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error('Axios error:', error.response?.data || error.message);
            throw new InternalServerErrorException(`Axios error: ${error.message}`);
          }),
        ),
      );

      if (res.status >= 200 && res.status < 300 && res.data.status == 'UP') {
        return 'available';
      } else {
        return 'unavailable';
      }
    } catch (error) {
      if (error.isAxiosError) {
        this.logger.error('Axios error:', error.message);
      } else {
        this.logger.error('Unknown error:', error);
      }
      return 'unavailable';
    }
  }

  extractS3FileId(input: string): string | null {
    // Use a regex to match the pattern between -s3b- and -S3BucketFile
    const regex = /-s3b-([^-\s]+?)-S3BucketFile/;
    const match = input.match(regex);

    // If a match is found, return the first capturing group
    return match ? match[1] : null;
  }

  replaceAndDecode(input: string): string {
    // Regular expression to find values between ! and ;
    const regex = /!(.*?)\;/g;

    // Replace captured values with "%captured-value"
    const modifiedInput = input.replace(regex, (_, capturedValue) => {
      return `%${capturedValue}`;
    });

    // Step 2: Decode the modified input
    const decodedOutput = decodeURIComponent(modifiedInput);

    return decodedOutput;
  }
}
