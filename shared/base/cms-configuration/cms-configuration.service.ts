import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BaseService } from '../base.service';
import { TridionService } from '../../common/graphql/tridion.service';
import { CmsConfiguration } from '../interfaces/cms-configuration.interface';
import { UtilsService } from '../../common/utils/utils.service';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import { GET_LABELS } from '../queries/label.query'; //Fetch configuration using same query
import { ComponentDto } from '../dto/component.dto';

@Injectable()
export class CmsConfigurationService {
  constructor(
    private readonly utilService: UtilsService,
    private readonly baseService: BaseService,
    private readonly tridionService: TridionService,
    private readonly cachingService: CachingService,
    private readonly logger: Logger,
  ) {}

  SERVICE: string = CmsConfigurationService.name;

  // templateless method api reuse the code of component list
  async getCmsConfigurationList(compDto: ComponentDto): Promise<CmsConfiguration> {
    this.logger.debug(
      `Fetching configuration list for compDto: ${JSON.stringify(compDto)}`,
      this.SERVICE,
    );

    try {
      let cacheKey = compDto.locale;

      if (compDto.id) {
        cacheKey += `_${compDto.id}`;
      } else if (compDto.title) {
        cacheKey += `_${compDto.title}`;
      } else {
        if (!compDto.type) {
          const defaultType = this.utilService.getDefaultCmsConfigurationType();

          if (!defaultType) {
            throw new BadRequestException(
              'Configuration type must be provided or a default type must be available.',
            );
          }

          compDto.type = defaultType;
        }

        const itemTypes = this.addPrefix(compDto.type);
        compDto.type = itemTypes.join(',');
        cacheKey += `_${compDto.type}`;
      }
      const cachedCmsConfigurationData = await this.cachingService.getFromCache(
        CacheTypes.CMSCONFIGURATION,
        cacheKey,
      );

      if (cachedCmsConfigurationData) {
        return cachedCmsConfigurationData as CmsConfiguration;
      }

      const response = await this.baseService.getComponentList(compDto);

      const edges = response.data?.items?.edges;

      if (!edges || edges.length === 0) {
        this.logger.error(`Configurations not found`, this.SERVICE);
        throw new NotFoundException('No configurations found');
      }

      const cmsConfigurations = this.processNestedData(edges);

      await this.cachingService.putIntoCache(CacheTypes.CMSCONFIGURATION, {
        url: cacheKey,
        payload: cmsConfigurations,
      });

      return cmsConfigurations;
    } catch (error) {
      this.logger.error(
        `Error fetching configurations list: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  // templateless method api
  async getCmsConfigurations(localization: string, type: string): Promise<CmsConfiguration> {
    this.logger.debug(
      `Fetching CMS configurations for localization: ${localization}`,
      this.SERVICE,
    );

    try {
      const cmsConfigurationType: string = type
        ? type
        : this.utilService.getDefaultCmsConfigurationType();

      const cacheKey = localization + `_${cmsConfigurationType}`;
      const cachedCmsConfigurationData = await this.cachingService.getFromCache(
        CacheTypes.CMSCONFIGURATION,
        cacheKey,
      );

      if (cachedCmsConfigurationData) {
        return cachedCmsConfigurationData as CmsConfiguration;
      }

      const publicationIds = [await this.baseService.getPublicationIdByLocale(localization)];

      const itemTypes = this.addPrefix(cmsConfigurationType);

      const variables = {
        namespaceId: 1,
        publicationIds: publicationIds,
        itemTypes: itemTypes,
      };

      const response = await this.tridionService.query(GET_LABELS, variables);

      const edges = response.data?.items?.edges;

      if (!edges || edges.length === 0) {
        this.logger.error(`Configurations not found`, this.SERVICE);
        throw new NotFoundException('No configurations found');
      }

      const cmsConfigurations = this.processNestedData(edges);

      await this.cachingService.putIntoCache(CacheTypes.CMSCONFIGURATION, {
        url: cacheKey,
        payload: cmsConfigurations,
      });

      return cmsConfigurations;
    } catch (error) {
      this.logger.error(
        `Error fetching configurations: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  private addPrefix(input: string): string[] {
    return input
      .replace(/,\s*$/, '')
      .split(',')
      .map(type => `CONFIGURATION_${type.trim()}`);
  }

  processNestedData(edges: any): CmsConfiguration {
    const cmsConfigurationsData: CmsConfiguration = {};

    if (edges) {
      edges.forEach((edge: any) => {
        if (edge?.node?.content?.data?.settings?.$values) {
          const settings = edge.node.content.data.settings.$values;

          settings.forEach((setting: any) => {
            if (setting.name && setting.value) {
              cmsConfigurationsData[setting.name] = setting.value;
            }
          });
        }
      });
    }

    return cmsConfigurationsData;
  }
}
