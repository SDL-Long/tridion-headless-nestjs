import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Component, Components, Content } from '../interfaces/base.interface';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import { BaseService } from '../base.service';
import {
  GET_COMPONENT,
  GET_COMPONENT_LIST_BY_TYPE,
  GET_COMPONENT_TOTAL_NUMBER_BY_TYPE,
  GET_COMPONENT_LIST_BY_TYPE2,
  GET_COMPONENT_METADATA,
} from '../queries/component.query';
import { TridionService } from '../../common/graphql/tridion.service';
import { ComponentDto } from '../dto/component.dto';
import { ComponentListDto } from '../dto/componentList.dto';

@Injectable()
export class ComponentService {
  constructor(
    private readonly baseService: BaseService,
    private readonly logger: Logger,
    private readonly cachingService: CachingService,
    private readonly tridionService: TridionService,
  ) {}

  SERVICE: string = ComponentService.name;

  // templateless method api
  async getComponent(url: string): Promise<Component> {
    this.logger.debug(`Fetching component data for URL: ${url}`, this.SERVICE);

    try {
      const normalizedUrl = this.baseService.ensureLeadingSlash(url);

      const componentId = this.baseService.getComponentId(normalizedUrl);
      const { publicationId } = await this.baseService.resolveLocalization(normalizedUrl);

      const variables = {
        namespaceId: 1,
        publicationId: publicationId,
        componentId: componentId,
      };

      const response = await this.tridionService.query(GET_COMPONENT, variables);
      const currentComponent = response.data?.component;

      if (!currentComponent) {
        this.logger.warn(`Component not found for URL: ${url}`, this.SERVICE);
        throw new NotFoundException(`Component not found for URL: ${url}`);
      }

      return await this.convertComponentData(currentComponent);
    } catch (error) {
      this.logger.error(`Error fetching component data for URL: ${url}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async getComponentMetadata(url: string): Promise<Component> {
    this.logger.debug(`Fetching component metadata for URL: ${url}`, this.SERVICE);

    try {
      const normalizedUrl = this.baseService.ensureLeadingSlash(url);
      const componentId = this.baseService.getComponentId(normalizedUrl);
      const { publicationId } = await this.baseService.resolveLocalization(normalizedUrl);

      const variables = {
        namespaceId: 1,
        publicationId: publicationId,
        componentId: componentId,
      };

      const response = await this.tridionService.query(GET_COMPONENT_METADATA, variables);
      const currentComponent = response.data?.component;

      if (!currentComponent) {
        this.logger.warn(`Component metadata not found for URL: ${url}`, this.SERVICE);
        throw new NotFoundException(`Component metadata not found for URL: ${url}`);
      }

      const comp: Component = {
        id: currentComponent.itemId,
        title: currentComponent.title,
        resolvedLink: currentComponent.resolvedLink?.url?.replace(/\.html(?=[?#]|$)/gi, ''),
        publicationId: currentComponent.publicationId,
        componentCustomMetadata: this.baseService.processCustomMetadata(
          currentComponent.customMetas?.edges || [],
        ),
      };

      return comp;
    } catch (error) {
      this.logger.error(`Error fetching component metadata for URL: ${url}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  private async convertComponentData(component: any): Promise<Component> {
    this.logger.debug(`Converting component data: ${component.itemId}`, this.SERVICE);

    try {
      const comp: Component = {} as Component;
      comp.id = component.itemId;
      comp.title = component.title;
      comp.schemaId = component.schemaId;
      comp.resolvedLink = component.resolvedLink?.url?.replace(/\.html(?=[?#]|$)/gi, '');
      comp.publicationId = component.publicationId;
      comp.lastPublishedDate = component.lastPublishDate;
      comp.modifiedDate = component.updatedDate;
      comp.componentCustomMetadata = this.baseService.processCustomMetadata(
        component.customMetas?.edges || [],
      );

      const compData = component.content?.data;
      const content: Content = {} as Content;
      await this.baseService.processNestedFields(compData, content);
      comp.content = content;

      return comp;
    } catch (error) {
      this.logger.error(`Error converting component data: ${component.itemId}`, error.stack);
      throw error;
    }
  }

  // templateless method api
  async getComponentList(compDto: ComponentDto): Promise<Components> {
    this.logger.debug(
      `Fetching component list with parameters: ${JSON.stringify(compDto)}`,
      this.SERVICE,
    );

    try {
      let cacheKey = compDto.locale;

      if (compDto.id) {
        cacheKey += `_${compDto.id}`;
      } else if (compDto.title) {
        cacheKey += `_${compDto.title}`;
      } else {
        cacheKey += `_${compDto.type}`;
      }

      const cachedComponentListData = await this.cachingService.getFromCache(
        CacheTypes.COMPONENTLIST,
        cacheKey,
      );

      if (cachedComponentListData) {
        return cachedComponentListData as Components;
      }

      const response = await this.baseService.getComponentList(compDto);

      const edges = response.data?.items?.edges;

      if (!edges || edges.length === 0) {
        this.logger.error(`Components not found`, this.SERVICE);
        throw new NotFoundException('No Components found');
      }

      const comps: Components = {} as Components;

      comps.components = await Promise.all(
        edges.map((edge: any) => this.convertComponentData(edge.node)),
      );

      await this.cachingService.putIntoCache(CacheTypes.COMPONENTLIST, {
        url: cacheKey,
        payload: comps,
      });

      return comps;
    } catch (error) {
      this.logger.error(`Error fetching component list`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async getComponentListBySchemaAndType(componentDto: ComponentListDto, options?: { ttl?: number }): Promise<Components> {
    try {
      const locale = componentDto.locale;
      const schemaTitle = componentDto.title;
      const type = componentDto.type;
      const size = componentDto.pageSize;
      const start = componentDto.start;
      const deviceType = componentDto.deviceType;

      const cacheKeySuffix = [
        locale,
        schemaTitle,
        size,
        start || 0,
        type || 'notype',
        deviceType || 'nodevice'
      ].join('_');

      const cacheKey = 'ComponentListBySchemaAndType-' + cacheKeySuffix.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

      const cachedComponentListData = await this.cachingService.getFromCache(
        CacheTypes.COMPONENTLIST,
        cacheKey,
      );

      if (cachedComponentListData) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return cachedComponentListData as Components;
      }

      this.logger.debug(`Cache miss for key: ${cacheKey}`);

      const { publicationId } = await this.baseService.resolveLocalization(locale);
      this.logger.debug(`current publication is: ${publicationId}`);
      this.logger.debug(`page size is: ${size}`);
      this.logger.debug(`start is: ${start}`);
      this.logger.debug(`deviceType is: ${deviceType}`);
      this.logger.debug(`type is: ${type}`);

      let after = '';
      
      // Calculate cursor for pagination
      if (start && start > 0) {
        const offset = start - 1;
        // Encode byte array to Base64 string
        const stringVal = String(offset);
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(stringVal);
        const encodedString = btoa(String.fromCharCode.apply(null, uint8Array));
        after = encodedString;
        this.logger.debug(`Using cursor after: ${after} (offset: ${offset})`);
      } else {
        after = '';
        this.logger.debug(`No cursor (first page)`);
      }

      // Parse first/size parameter correctly
      let first = 0;
      if (typeof size === 'string') {
        first = parseInt(size, 10);
      } else {
        first = size;
      }

      if (isNaN(first) || first <= 0) {
        throw new BadRequestException('Invalid pageSize parameter');
      }

      // Build the filter object properly
      const inputItemFilter: any = {
        namespaceIds: 1,
        publicationIds: publicationId,
        schema: {
          title: schemaTitle,
        },
        itemTypes: 'COMPONENT',
      };

      // Handle multiple custom meta filters using 'and' operator
      const customMetaConditions = [];
      
      if (type) {
        customMetaConditions.push({
          customMeta: {
            key: 'type',
            value: type,
          },
        });
      }
      
      if (deviceType) {
        customMetaConditions.push({
          customMeta: {
            key: 'deviceType',
            value: deviceType,
          },
        });
      }

      // Apply filters correctly
      if (customMetaConditions.length === 1) {
        // Single filter - use customMeta directly
        inputItemFilter.customMeta = customMetaConditions[0].customMeta;
      } else if (customMetaConditions.length > 1) {
        // Multiple filters - use 'and' operator
        inputItemFilter.and = customMetaConditions;
      }

      const variables = {
        first: first,
        after: after,
        inputItemFilter: inputItemFilter,
        inputSortParam: {
          sortBy: 'LAST_PUBLISH_DATE',
          order: 'Descending',
        },
      };

      this.logger.debug(`GraphQL Variables: ${JSON.stringify(variables, null, 2)}`);

      const response = await this.tridionService.query(GET_COMPONENT_LIST_BY_TYPE, variables);
      const edges = response.data?.items?.edges;
      
      if (!edges || edges.length === 0) {
        this.logger.warn(`No components found for schema: ${schemaTitle}, deviceType: ${deviceType}, type: ${type}`);
        const emptyComps: Components = { components: [] };
        return emptyComps;
      }
      
      const comps: Components = { components: [] };
      comps.components = await Promise.all(
        edges.map((edge: any) => this.convertComponentData(edge.node)),
      );
      
      await this.cachingService.putIntoCache(CacheTypes.COMPONENTLIST, {
        url: cacheKey,
        payload: comps,
        ttl: options?.ttl,
      });
      
      this.logger.debug(`Successfully fetched and cached ${comps.components.length} components`);

      return comps;
    } catch (error) {
      this.logger.error(`Error fetching component list`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async getComponentListByCriteria(componentDto: ComponentListDto): Promise<Components> {
    /**
     * Criteria: 
     * type, 
     * subtype, 
     * label, 
     * tag
     * 
     * Sortby: startTime
     * */
    try {
      const locale = componentDto.locale;
      const schemaTitle = componentDto.title;
      const type = componentDto.type;
      const subtypes = componentDto.subtype;
      const labels = componentDto.label;
      const tag = componentDto.tag;
      const size = componentDto.pageSize;
      const start = componentDto.start;
      const deviceType = componentDto.deviceType;
      const maxTotal = componentDto.maxTotal || 500;

      const cacheKeySuffix = locale + schemaTitle + size + (type || '') + (subtypes || '') + (labels || '') + (tag || '') + start

      const cacheKey =
        'ComponentListByCriteria-' + cacheKeySuffix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      const cachedComponentListData = await this.cachingService.getFromCache(
        CacheTypes.COMPONENTLIST,
        cacheKey,
      );

      if (cachedComponentListData) {
        return cachedComponentListData as Components;
      }

      const { publicationId } = await this.baseService.resolveLocalization(locale);
      this.logger.debug(`current publication is: ${publicationId}`);
      this.logger.debug(`page size is: ${size}`);
      let after = '';

      if (start > 0) {
        // Compute cursor value. Query would obtain the result after the specified cursor.
        // Encode byte array to Base64 string, start from 0, e.g. MA== -> 0; MQ== -> 1
        const stringVal = String(start - 1);
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(stringVal);
        const encodedString = btoa(String.fromCharCode.apply(null, uint8Array));
        after = encodedString;
      }

      this.logger.debug(`after is: ${after}`);
      this.logger.debug(`schema is: ${schemaTitle}`);
      this.logger.debug(`type is: ${type}`);
      this.logger.debug(`subtypes is/are: ${subtypes}`);
      this.logger.debug(`labels is/are: ${labels}`);
      this.logger.debug(`tag is: ${tag}`);

      this.logger.debug(`first vale is type of : ${typeof size}`);
      let first = 0;

      if (typeof size === 'string') {
        // Convert to integer
        first = parseInt(size, 10);
      } else {
        first = size;
      }

      const variables = buildFilterVariables({
        first: first,
        after: `${after}`,
        publicationId: publicationId,
        schemaTitle: `${schemaTitle}`,
        type: type,
        subtypes: subtypes,
        labels: labels,
        tag: tag,
      });

      // try to get total number
      const totalResp = await this.tridionService.query(GET_COMPONENT_TOTAL_NUMBER_BY_TYPE, variables);
      const rawTotal = totalResp.data?.items?.edges ?? [];
      const total = rawTotal.length;
      if (total === 0) {
        this.logger.warn(`Components total not found`, this.SERVICE);
      }

      const response = await this.tridionService.query(GET_COMPONENT_LIST_BY_TYPE2, variables);
      const edges = response.data?.items?.edges;
      if (!edges || edges.length === 0) {
        this.logger.warn(`Components not found`, this.SERVICE);
        throw new NotFoundException('No Components found');
      }
      const comps: Components = {} as Components;
      comps.components = await Promise.all(
        edges.map((edge: any) => this.convertComponentData(edge.node)),
      );
      // Append total to component list
      comps.total = total;
      await this.cachingService.putIntoCache(CacheTypes.COMPONENTLIST, {
        url: cacheKey,
        payload: comps,
      });

      return comps;
    } catch (error) {
      this.logger.error(`Error fetching component list`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async getMaxTotalComponentListByCriteria(componentDto: ComponentListDto): Promise<Components> {
    /**
     * Criteria: 
     * type, 
     * subtype, 
     * label, 
     * tag
     * 
     * Sortby: startTime
     * */
    try {
      const locale = componentDto.locale;
      const schemaTitle = componentDto.title;
      const type = componentDto.type;
      const subtypes = componentDto.subtype;
      const labels = componentDto.label;
      const tag = componentDto.tag;
      const size = componentDto.pageSize;
      const start = componentDto.start;
      const deviceType = componentDto.deviceType;
      const maxTotal = componentDto.maxTotal || 500;

      const cacheKeySuffix = locale + schemaTitle + maxTotal + (type || '') + (subtypes || '') + (labels || '') + (tag || '')

      const cacheKey =
        'ComponentListByCriteria-' + cacheKeySuffix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      const cachedComponentListData = await this.cachingService.getFromCache(
        CacheTypes.COMPONENTLIST,
        cacheKey,
      );

      if (cachedComponentListData) {
        const cachedComponents = cachedComponentListData as Components;
        const pc = this.paginatedComponents(cachedComponents.components, (start<1 ? 0 : start-1), size);
        const total = cachedComponents?.total || cachedComponents?.components?.length || 0;
        this.logger.debug(`Cached total is: ${total}`);
        return {
          ...cachedComponentListData,
          components: pc,
          total: total,
        };
      }

      const { publicationId } = await this.baseService.resolveLocalization(locale);
      const after = null;
      this.logger.debug(`current publication is: ${publicationId}`);
      this.logger.debug(`max total is: ${maxTotal}`);
      this.logger.debug(`page size is: ${size}`);
      this.logger.debug(`start from: ${start}`);
      this.logger.debug(`after is: ${after}`);
      this.logger.debug(`schema is: ${schemaTitle}`);
      this.logger.debug(`type is: ${type}`);
      this.logger.debug(`subtypes is/are: ${subtypes}`);
      this.logger.debug(`labels is/are: ${labels}`);
      this.logger.debug(`tag is: ${tag}`);

      const variables = buildFilterVariables({
        first: maxTotal,
        after: after,
        publicationId: publicationId,
        schemaTitle: `${schemaTitle}`,
        type: type,
        subtypes: subtypes,
        labels: labels,
        tag: tag,
      });

      const response = await this.tridionService.query(GET_COMPONENT_LIST_BY_TYPE2, variables);
      const edges = response.data?.items?.edges;
      if (!edges || edges.length === 0) {
        this.logger.warn(`Components not found`, this.SERVICE);
        throw new NotFoundException('No Components found');
      }

      const now = new Date();
      const comps: Components = {} as Components;
      comps.components = (await Promise.all(
        edges.map((edge: any) => this.convertComponentData(edge.node)),
      )).filter((component: Component) => {
        // filter GraphQL results by component start and end time, which is startTime < now < endTime, then return the result
        // 检查组件是否有 convertComponentData
        if (!component.componentCustomMetadata) {
          return false; // 如果没有metadata配置，过滤掉
        }
        if (component.componentCustomMetadata.startTime && now < new Date(component.componentCustomMetadata.startTime)) {
          return false; // 如果有startTime且当前时间小于startTime，过滤掉
        }
        if (component.componentCustomMetadata.endTime && now > new Date(component.componentCustomMetadata.endTime)) {
          return false; // 如果有endTime且当前时间>endTime，过滤掉
        }

        return true;
      }) as Component[];

      const total = comps?.components?.length??0;
      comps.total = total;
      this.logger.debug(`After filtering total is: ${total}`);

      // put into cache
      await this.cachingService.putIntoCache(CacheTypes.COMPONENTLIST, {
        url: cacheKey,
        payload: comps,
      });

      // 关键分页代码：
      const pc = this.paginatedComponents(comps.components, (start<1 ? 0 : start-1), size);
      
      // 保持数据结构一致，并只返回分页内容
      return {
        ...comps,
        components: pc,
        total,
      };
    } catch (error) {
      this.logger.error(`Error fetching component list`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }
  
  /**
   * 
   * @param components - all components
   * @param start - from 0
   * @param size - page size
   * @returns 
   */
  paginatedComponents(components: Component[], start: number, size: number): Component[] {
    const end = start + size < components.length ? start + size : components.length;
    this.logger.debug(`paginated: ${start} to ${end} , length: ${components.length} `);
    return components.slice(start, end);
  }
}

/**
 * Sample:
 * 
  inputItemFilter: {
    namespaceIds: 1,
    publicationIds: 123,
    schema: { title: "Article" },
    itemTypes: 'COMPONENT',

    and: [
      { customMeta: { key: 'type', value: 'news' } },       // type 单值
      { or: [                                                // subtypes 多值 OR
        { customMeta: { key: 'subtype', value: 'tech' } },
        { customMeta: { key: 'subtype', value: 'mobile' } }
      ] },
      { or: [                                                // labels 多值 OR
        { customMeta: { key: 'labels', value: 'breaking' } },
        { customMeta: { key: 'labels', value: 'highlight' } }
      ] },
      { customMeta: { key: 'tag', value: 'summer2025' } }   // tag 单值
    ]
  }
 * @param 
 * @returns 
 */
function buildFilterVariables({
  first,
  after,
  publicationId,
  schemaTitle,
  type,
  subtypes,
  labels,
  tag,
}: {
  first: number;
  after: string;
  publicationId: number;
  schemaTitle: string;
  type?: string;
  subtypes?: string[];
  labels?: string[];
  tag?: string;
}) {
  const andConditions: any[] = [];

  // type 单值 AND
  if (type) {
    andConditions.push({
      customMeta: { key: 'type', value: type },
    });
  }

  // subtypes 多值 OR -> 封装成一个 or 块
  if (subtypes && subtypes.length > 0) {
    const orSubtypes = subtypes.map((val) => ({
      customMeta: { key: 'subtype', value: val },
    }));
    andConditions.push({ or: orSubtypes });
  }

  // labels 多值 OR -> 封装成一个 or 块
  if (labels && labels.length > 0) {
    const orLabels = labels.map((val) => ({
      customMeta: { key: 'labels', value: val },
    }));
    andConditions.push({ or: orLabels });
  }

  // tag 单值 AND
  if (tag) {
    andConditions.push({
      customMeta: { key: 'tag', value: tag },
    });
  }

  const inputItemFilter: any = {
    namespaceIds: 1,
    publicationIds: publicationId,
    schema: { title: schemaTitle },
    itemTypes: 'COMPONENT',
  };

  if (andConditions.length > 0) {
    inputItemFilter.and = andConditions;
  }

  return {
    first,
    after,
    inputItemFilter,
    inputSortParam: {
      // sort by custom metadata startTime
      key: 'startTime',
      keyType: 'DATE',
      sortBy: 'CUSTOM_META',
      order: 'Descending',
    },
  };
}
