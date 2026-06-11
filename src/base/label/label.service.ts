import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BaseService } from '../base.service';
import { TridionService } from '../../common/graphql/tridion.service';
import { Label } from '../interfaces/label.interface';
import { UtilsService } from '../../common/utils/utils.service';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import { GET_LABELS } from '../queries/label.query';
import { ComponentDto } from '../dto/component.dto';
// import { CronJob } from 'cron';
// import { SchedulerRegistry } from '@nestjs/schedule';
import * as CONSTANTS from '../../constants';


@Injectable()
export class LabelService {
  constructor(
    private readonly utilService: UtilsService,
    private readonly baseService: BaseService,
    private readonly tridionService: TridionService,
    private readonly cachingService: CachingService,
    private readonly logger: Logger,
    // private schedulerRegistry: SchedulerRegistry
  ) {}

  SERVICE: string = LabelService.name;

  async initialize(): Promise<void> {
    try {
      await this.loadLabels();
      this.logger.log('Label cache initialized');
    } catch (error) {
      this.logger.error(
        `Initialization failed: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      throw new InternalServerErrorException('Failed to initialize labels');
    }
  }

  // async initialize(): Promise<void> {
  //   try {
  //     await this.loadLabels();

  //     const baseInterval = this.utilService.getLabelCacheTtlForCronJob();
  //     const jitter = Math.floor(Math.random() * 5 * 60 * 1000);
  //     const cronInterval = baseInterval + jitter;

  //     const cronExpression = this.utilService.convertMillisecondsToCron(cronInterval);

  //     this.addDynamicCronJob('updateLabels', cronExpression);
  //   } catch (error) {
  //     this.logger.error(
  //       `Error during OnApplicationBootstrap: ${error.message}`,
  //       { stack: error.stack, service: this.SERVICE, context: 'Initialization' },
  //     );
  //     throw new InternalServerErrorException('Failed to initialize application');
  //   }
  // }

  // addDynamicCronJob(name: string, cronExpression: string): void {
  //   this.logger.warn(`CRON EXPRESSION = ${cronExpression}`);
  //   const job = new CronJob(
  //     cronExpression,
  //     async () => {
  //       try {
  //         this.logger.debug(`Dynamic Cron job "${name}" triggered`, { cronExpression, name });
  //         await this.loadLabels();
  //       } catch (error) {
  //         this.logger.error(
  //           `Error in Cron job "${name}"`,
  //           { message: error.message, stack: error.stack, cronExpression, name, service: this.SERVICE },
  //         );
  //       }
  //     });

  //   this.schedulerRegistry.addCronJob(name, job);
  //   job.start();
  //   this.logger.debug(`Dynamic Cron job "${name}" added with expression "${cronExpression}"`, { cronExpression, name });
  // }

  async loadLabels(): Promise<void> {
    const cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);

    if (!cachedLocalizations) {
      throw new InternalServerErrorException(CONSTANTS.ERROR_LOCALIZATIONS_NOT_FOUND);
    }
    await Promise.all(
      cachedLocalizations.map(async (localization: any) => {
        try {
          const locale = this.baseService.normalizePath(localization.path);
          const labelSchema = this.utilService.getDefaultLabelSchema();
          const cacheKey = locale + `_${labelSchema}`;

          const compDto: ComponentDto = {
            locale: locale,
            title: labelSchema,
          };

          const response = await this.baseService.getComponentList(compDto);

          const edges = response.data?.items?.edges;

          if (!edges || edges.length === 0) {
            this.logger.error(`Labels are not found for the locale - ${locale}`, this.SERVICE);
            return;
          }

          const labels = this.processNestedLabelData(edges);

          await this.cachingService.putIntoCache(CacheTypes.LABEL, {
            url: cacheKey,
            payload: labels,
          });
        } catch (error) {
          this.logger.error(
            `Error loading labels for localization: ${localization.path}`,
            { message: error.message, stack: error.stack, localization, service: this.SERVICE },
          );
        }
      }),
    );
  }

  // templateless method api reuse the code of component list
  async getLabelsBySchemaOrItemTypes(compDto: ComponentDto): Promise<Label> {
    this.logger.debug(`Fetching label list for compDto: ${JSON.stringify(compDto)}`, this.SERVICE);

    try {
      let cacheKey = this.baseService.normalizePath(compDto.locale);

      if (compDto.id) {
        cacheKey += `_${compDto.id}`;
      } else if (compDto.title) {
        cacheKey += `_${compDto.title}`;
      } else {
        if (!compDto.type) {
          const defaultType = this.utilService.getDefaultLabelType();

          if (!defaultType) {
            throw new BadRequestException(
              'Label type must be provided or a default type must be available.',
            );
          }

          compDto.type = defaultType;
        }

        const itemTypes = this.addPrefix(compDto.type);
        compDto.type = itemTypes.join(',');
        cacheKey += `_${compDto.type}`;
      }
      const cachedLabelsData = await this.cachingService.getFromCache(CacheTypes.LABEL, cacheKey);

      if (cachedLabelsData) {
        return cachedLabelsData as Label;
      }

      const response = await this.baseService.getComponentList(compDto);

      const edges = response.data?.items?.edges;

      if (!edges || edges.length === 0) {
        this.logger.error(`Labels not found`, this.SERVICE);
        throw new NotFoundException('No Labels found');
      }

      const labels = this.processNestedLabelData(edges);

      await this.cachingService.putIntoCache(CacheTypes.LABEL, {
        url: cacheKey,
        payload: labels,
      });

      return labels;
    } catch (error) {
      this.logger.error(`Error fetching label list: ${error.message}`, error.stack, this.SERVICE);
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
      .map(type => `${type.trim()}`);
  }

  processNestedLabelData(edges: any): Label {
    const labelsData: Label = {};

    if (edges) {
      edges.forEach((edge: any) => {
        if (edge?.node?.content?.data?.resources?.$values) {
          const resources = edge.node.content.data.resources.$values;

          resources.forEach((resource: any) => {
            if (resource.name && resource.value) {
              labelsData[resource.name] = resource.value;
            }
          });
        }
      });
    }

    return labelsData;
  }

  // templateless method api reusing the code of component list
  async getLabelList(compDto: ComponentDto): Promise<Label> {
    this.logger.debug(`Fetching label list for compDto: ${JSON.stringify(compDto)}`, this.SERVICE);

    try {
      let cacheKey = compDto.locale;

      if (compDto.id) {
        cacheKey += `_${compDto.id}`;
      } else if (compDto.title) {
        cacheKey += `_${compDto.title}`;
      } else {
        if (!compDto.type) {
          const defaultType = this.utilService.getDefaultLabelType();

          if (!defaultType) {
            throw new BadRequestException(
              'Label type must be provided or a default type must be available.',
            );
          }

          compDto.type = defaultType;
        }

        const itemTypes = this.addLabelsPrefix(compDto.type);
        compDto.type = itemTypes.join(',');
        cacheKey += `_${compDto.type}`;
      }

      const cachedLabelData = await this.cachingService.getFromCache(CacheTypes.LABEL, cacheKey);

      if (cachedLabelData) {
        return cachedLabelData as Label;
      }

      const response = await this.baseService.getComponentList(compDto);

      const edges = response.data?.items?.edges;

      if (!edges || edges.length === 0) {
        this.logger.error(`Labels not found`, this.SERVICE);
        throw new NotFoundException('No labels found');
      }

      const labels = this.processNestedData(edges);

      await this.cachingService.putIntoCache(CacheTypes.LABEL, {
        url: cacheKey,
        payload: labels,
      });

      return labels;
    } catch (error) {
      this.logger.error(`Error fetching label list: ${error.message}`, error.stack, this.SERVICE);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  // templateless method api
  async getLabel(localization: string, type: string): Promise<Label> {
    this.logger.debug(`Fetching labels for localization: ${localization}`, this.SERVICE);

    try {
      const labelType: string = type ? type : this.utilService.getDefaultLabelType();

      const cacheKey = localization + `_${labelType}`;
      const cachedLabelData = await this.cachingService.getFromCache(CacheTypes.LABEL, cacheKey);

      if (cachedLabelData) {
        return cachedLabelData as Label;
      }

      const publicationIds = [await this.baseService.getPublicationIdByLocale(localization)];

      const itemTypes = this.addLabelsPrefix(labelType);

      const variables = {
        namespaceId: 1,
        publicationIds: publicationIds,
        itemTypes: itemTypes,
      };

      const response = await this.tridionService.query(GET_LABELS, variables);

      const edges = response.data?.items?.edges;

      if (!edges || edges.length === 0) {
        this.logger.error(`Labels not found`, this.SERVICE);
        throw new NotFoundException('No labels found');
      }

      const labels = this.processNestedData(edges);

      await this.cachingService.putIntoCache(CacheTypes.LABEL, {
        url: cacheKey,
        payload: labels,
      });

      return labels;
    } catch (error) {
      this.logger.error(`Error fetching labels: ${error.message}`, error.stack, this.SERVICE);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  processNestedData(edges: any): Label {
    const labelsData: Label = {};

    edges.forEach((edge: any) => {
      if (edge && edge.node && edge.node.content && edge.node.content.data) {
        const data = edge.node.content.data;
        const { $type, ...rest } = data;
        this.logger.debug('type is:' + $type);
        Object.assign(labelsData, rest);
      }
    });

    return labelsData;
  }

  private addLabelsPrefix(input: string): string[] {
    if (!input) {
      return [];
    }
    return input
      .replace(/,\s*$/, '')
      .split(',')
      .map(type => `LABELS_${type.trim()}`);
  }
}
