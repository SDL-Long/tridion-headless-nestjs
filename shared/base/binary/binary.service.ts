import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BinaryComponent, BinaryResponse } from '../interfaces/binary.interface';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import { BaseService } from '../base.service';
import { GraphqlAuthService } from '../../common/graphql/graphql-auth.service';
import * as mime from 'mime';
import * as CONSTANTS from '../../constants';
import * as fs from 'fs-extra';
import * as path from 'path';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BinaryService {
  constructor(
    private readonly baseService: BaseService,
    private readonly logger: Logger,
    private readonly cachingService: CachingService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly graphqlAuthService: GraphqlAuthService,
  ) {}

  SERVICE: string = BinaryService.name;

  async getBinaryComponentByCmUri(cmUri: string): Promise<BinaryComponent> {
    this.logger.debug(`Fetching binary component by URI: ${cmUri}`, this.SERVICE);

    try {
      const cachedBinaryData = await this.cachingService.getFromCache(CacheTypes.BINARY, cmUri);

      if (cachedBinaryData) {
        return cachedBinaryData as BinaryComponent;
      }

      const response = await this.baseService.getBinaryComponentByCmUri(cmUri);

      const currentComponent = response.binaryComponent;

      if (!currentComponent) {
        this.logger.error(`Binary component not found for URI: ${cmUri}`, this.SERVICE);
        throw new NotFoundException(`No binary component found for URI: ${cmUri}`);
      }

      const binaryComponent: BinaryComponent = this.convertBinaryComponentData(currentComponent);
      await this.cachingService.putIntoCache(CacheTypes.BINARY, {
        url: cmUri,
        payload: binaryComponent,
      });

      return binaryComponent;
    } catch (error) {
      this.logger.error(
        `Error fetching binary component by URI: ${cmUri}`,
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

  async getBinaryComponentById(localization: string, id: number): Promise<BinaryComponent> {
    this.logger.debug(
      `Fetching binary component by Id ${id} for localization ${localization}`,
      this.SERVICE,
    );

    try {
      const cacheKey = localization + `_${id}`;
      const cachedBinaryData = await this.cachingService.getFromCache(CacheTypes.BINARY, cacheKey);

      if (cachedBinaryData) {
        return cachedBinaryData as BinaryComponent;
      }

      const publicationId = await this.baseService.getPublicationIdByLocale(localization);

      const response = await this.baseService.getBinaryComponentById(publicationId, id);

      const currentComponent = response.binaryComponent;

      if (!currentComponent) {
        this.logger.error(
          `Binary component not found for Id: ${publicationId}-${id}`,
          this.SERVICE,
        );
        throw new NotFoundException(`No binary component found for Id: ${publicationId}-${id}`);
      }

      const binaryComponent: BinaryComponent = this.convertBinaryComponentData(currentComponent);
      await this.cachingService.putIntoCache(CacheTypes.BINARY, {
        url: cacheKey,
        payload: binaryComponent,
      });

      return binaryComponent;
    } catch (error) {
      this.logger.error(`Error fetching binary component by Id: ${id}`, error.stack, this.SERVICE);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  private convertBinaryComponentData(component: any): BinaryComponent {
    const comp: BinaryComponent = {} as BinaryComponent;
    comp.id = component.itemId;
    comp.title = component.title;
    comp.schemaId = component.schemaId;
    comp.publicationId = component.publicationId;

    if (
      component.variants &&
      Array.isArray(component.variants.edges) &&
      component.variants.edges.length > 0
    ) {
      const node = component.variants.edges[0]?.node;
      if (node) {
        comp.downloadUrl = node?.downloadUrl || null;
        comp.url = node.url || null;
        comp.path = node.path || null;
        comp.description = node.description;
      }
    }

    comp.componentCustomMetadata = this.baseService.processCustomMetadata(
      component.customMetas?.edges || [],
    );

    return comp;
  }

  /**
   * Binary Handling - Cache Binary in redis/memorey
   *
   * */
  async getBinaryComponentByUrl(url: string): Promise<BinaryResponse> {
    this.logger.debug(`Fetching binary component by URL: ${url}`, this.SERVICE);

    try {
      const encodedUrl = this.baseService.urlPartialPathEncode(url);
      const cachedBinaryData = await this.cachingService.getFromCache(
        CacheTypes.BINARY,
        encodedUrl,
      );
      const cacheBinaryType = await this.cachingService.getFromCache(
        CacheTypes.BINARYTYPE,
        encodedUrl,
      );

      if (cacheBinaryType) {
        const type = cacheBinaryType || null;
        return { data: Buffer.from(cachedBinaryData, 'base64'), type };
      }

      const { publicationId } = await this.baseService.resolveLocalization(encodedUrl);

      const binaryId = this.baseService.extractBinaryIdFromUrl(encodedUrl);

      const binaryResponse = await this.baseService.getBinaryComponentById(publicationId, binaryId);

      const currentComponent = binaryResponse.binaryComponent;

      const { downloadUrl, type } = this.processBinaryData(currentComponent, encodedUrl);

      // fetch binary data (buffer)
      const binaryData = await this.fetchBinaryDataFromDownloadUrl(downloadUrl);

      const base64Data = binaryData.toString('base64');
      await this.cachingService.putIntoCache(CacheTypes.BINARY, {
        url: encodedUrl,
        payload: base64Data,
      });
      await this.cachingService.putIntoCache(CacheTypes.BINARYTYPE, {
        url: encodedUrl,
        payload: type || '',
      });

      return { data: binaryData, type };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        this.logger.warn(
          `Binary not found or bad request for URL: ${url}`,
          this.SERVICE,
        );
        throw error;
      }
    
      this.logger.error(
        `Error fetching binary component by URL: ${url}`,
        error.stack,
        this.SERVICE,
      );
    
      throw new InternalServerErrorException(error.message);
    }
  }

  private processBinaryData(
    binaryComponent: any,
    url: string,
  ): { downloadUrl: string; type: string } {
    try {
      if (!binaryComponent) {
        this.logger.warn(`Binary component not found for URL: ${url}`, this.SERVICE);
        throw new NotFoundException(`Binary component not found for URL: ${url}`);
      }

      const variants = binaryComponent.variants;
      if (!variants || !Array.isArray(variants.edges) || variants.edges.length === 0) {
        this.logger.error(
          `Empty or invalid variants for binary component: ${binaryComponent.itemId}`,
        );
        throw new NotFoundException(`Unable to get binary data for URL: ${url}`);
      }

      const variant = variants.edges[0]?.node;
      if (!variant?.downloadUrl) {
        this.logger.error(
          `Binary variant download URL is missing for binary component: ${binaryComponent.itemId}`,
        );
        throw new NotFoundException(`Unable to get binary data for URL: ${url}`);
      }

      const downloadUrl = variant.downloadUrl ?? null;
      const path = variant.path ?? null;
      let type: string = 'application/octet-stream';

      try {
        const mimeType = path ? mime.lookup(path) : undefined;
        type = mimeType || variant.type || 'application/octet-stream';
      } catch (error) {
        this.logger.error(
          `Error determining MIME type for path: ${path}`,
          error.stack,
          this.SERVICE,
        );
        throw new InternalServerErrorException('Failed to determine MIME type.');
      }

      return { downloadUrl, type };
    } catch (error) {
      this.logger.error(
        `Error processing binary data: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      throw error;
    }
  }

  private async fetchBinaryDataFromDownloadUrl(downloadUrl: string): Promise<Buffer> {
    try {
      const authToken = await this.graphqlAuthService.getAccessToken();
      const response = await firstValueFrom(
        this.httpService
          .get(downloadUrl, {
            responseType: 'arraybuffer',
            headers: {
              Authorization: authToken ? `Bearer ${authToken}` : '',
            },
          })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(
                'Unable to get binary data:',
                error.response?.data || error.message,
              );
              throw new InternalServerErrorException(`Unable to get binary data: ${error.message}`);
            }),
          ),
      );

      if (response.status !== HttpStatus.OK) {
        throw new NotFoundException('Unable to get binary data');
      }

      return response.data;
      // return Buffer.from(response.data); // another way
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new HttpException('Failed to fetch binary data', HttpStatus.BAD_GATEWAY);
      }
    }
  }

  /**
   * Binary Handling - Cache Binary in Local FS
   *
   * */
  async getBinaryComponentByUrl2(url: string): Promise<BinaryResponse> {
    try {
      const encodedUrl = this.baseService.urlPartialPathEncode(url);
      const { publicationId } = await this.baseService.resolveLocalization(encodedUrl);
      const { localFilePath, binary } = await this.getCachedFile(encodedUrl, publicationId);
      const mimeType = localFilePath ? mime.lookup(localFilePath) : 'application/octet-stream';
      let imageBuffer: Buffer;

      if (!binary) {
        imageBuffer = await fs.readFile(localFilePath);
      } else {
        imageBuffer = binary;
      }

      return { data: imageBuffer, type: mimeType };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        this.logger.warn(
          `Binary not found for URL: ${url}`,
          this.SERVICE,
        );
        throw error;
      }
    
      this.logger.error(
        `Error fetching binary component by URL: ${url}`,
        error.stack,
        this.SERVICE,
      );
    
      throw new InternalServerErrorException(error.message);
    }
  }

  async getCachedFile(
    urlPath: string,
    publicationId: number,
  ): Promise<{ localFilePath: string; binary?: Buffer }> {
    const baseDir = process.cwd();
    const localFilePath = path.join(
      baseDir,
      CONSTANTS.BinaryStaticsFolder,
      `${CONSTANTS.CmUriScheme}-${publicationId}`,
      urlPath,
    );

    try {
      // Check if the cached file exists and if it is valid
      if (await fs.pathExists(localFilePath)) {
        const cached = await this.isCached(
          () => this.getBinaryLastPublishedDate(publicationId, urlPath),
          localFilePath,
        );
        if (cached) {
          return { localFilePath };
        }
      }

      // Fetch the binary data and write it to the file
      const binary = await this.getBinary(publicationId, urlPath);
      await this.writeBinaryToFile(binary, localFilePath);

      return { localFilePath, binary };
    } catch (error) {
      this.logger.error(`Failed to get cached file for URL '${urlPath}'`, error.stack);
      throw new NotFoundException('Failed to get cached file');
    }
  }

  async isCached(
    getBinaryLastPublishedDate: () => Promise<Date>,
    localFilePath: string,
  ): Promise<boolean> {
    try {
      const filePath = path.resolve(localFilePath);
      const stats = await fs.stat(filePath);
      const fileModifiedDate = stats.mtime;
      const lastPublishedDate = getBinaryLastPublishedDate();

      if (stats.size > 0 && fileModifiedDate.getTime() >= (await lastPublishedDate).getTime()) {
        this.logger.debug(
          `Binary at path '${localFilePath}' is still up to date, no action required`,
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking cache for file '${localFilePath}'`, error.stack);
      return false;
    }
  }

  async getBinaryLastPublishedDate(publicationId: number, urlPath: string): Promise<Date> {
    try {
      // cache binary last publish date
      const cachedDate = await this.cachingService.getFromCache(
        CacheTypes.BINARYLASTPUBLISHDATE,
        urlPath,
      );

      if (cachedDate) {
        return new Date(cachedDate);
      }

      const binaryId = this.baseService.extractBinaryIdFromUrl(urlPath);
      const binaryResponse = await this.baseService.getBinaryComponentLastPublishDateById(
        publicationId,
        binaryId,
      );
      const binaryComponent = binaryResponse.binaryComponent;
      const minDate = new Date(-8640000000000000); // Min date value

      const lastPublishDate =
        binaryComponent == null ? minDate : new Date(binaryComponent.lastPublishDate);

      this.cachingService.putIntoCache(CacheTypes.BINARYLASTPUBLISHDATE, {
        url: urlPath,
        payload: lastPublishDate,
      });

      return lastPublishDate;
    } catch (error) {
      this.logger.error(`Failed to get last published date for URL '${urlPath}'`, error.stack);
      throw new NotFoundException('Failed to retrieve last published date');
    }
  }

  async getBinary(publicationId: number, urlPath: string): Promise<Buffer> {
    try {
      const binaryId = this.baseService.extractBinaryIdFromUrl(urlPath);
      const binaryResponse = await this.baseService.getBinaryComponentById(publicationId, binaryId);
      const binaryComponent = binaryResponse.binaryComponent;
      const { downloadUrl } = this.processBinaryData(binaryComponent, urlPath);

      return await this.fetchBinaryDataFromDownloadUrl(downloadUrl);
    } catch (error) {
      this.logger.error(`Failed to get binary for URL '${urlPath}': ${error.message}`, error.stack);
      throw new NotFoundException(
        `Failed to retrieve binary data for URL '${urlPath}'. Original error: ${error.message}`,
      );
    }
  }

  async writeBinaryToFile(binary: Buffer, filePath: string): Promise<void> {
    try {
      const fullPath = path.resolve(filePath);
      const dir = path.dirname(fullPath);
      this.logger.debug(`Saving binary to ${fullPath}`);

      await fs.ensureDir(dir);
      await fs.writeFile(fullPath, binary);
      this.logger.debug(`Binary saved to ${fullPath}`);
    } catch (error) {
      this.logger.error(`Failed to save binary to ${filePath}`, error.stack);
      throw new NotFoundException('Failed to save binary file');
    }
  }

  async getBinaryComponentByEclUri(eclUri: string): Promise<any> {
    this.logger.debug(`getBinaryComponentByEclUri called with cmUri: ${eclUri}`, this.SERVICE);

    const fileId = this.baseService.extractS3FileId(eclUri);
    const decodedFileId = this.baseService.replaceAndDecode(fileId);
    const s3BucketDomainUrl = this.configService.get<string>('s3BucketUrl');

    const binaryUrl = s3BucketDomainUrl + decodedFileId;
    return binaryUrl;
  }
}
