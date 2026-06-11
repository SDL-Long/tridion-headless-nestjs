import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { BaseService } from '../base.service';
import { TridionService } from '../../common/graphql/tridion.service';
import { Redirect } from '../interfaces/redirects.interface';
import { GET_COMPONENT_LIST2 } from '../queries/component.query';
import { UtilsService } from '../../common/utils/utils.service';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';

@Injectable()
export class RedirectsService {
	constructor(
		private readonly utilService: UtilsService,
		private readonly baseService: BaseService,
		private readonly tridionService: TridionService,
		private readonly cachingService: CachingService,
		private readonly logger: Logger,
	) { }
	SERVICE: string = RedirectsService.name;

	private async processRedirectsData(edges: any): Promise<Redirect[]> {
		try {
			const redirectsData: Redirect[] = [];
			if (edges) {
				edges.forEach((edge: any) => {
					if (edge?.node?.content?.data?.redirects?.$values) {
						const redirects = edge.node.content.data.redirects.$values;
			
						redirects.forEach((redirect: any) => {
							redirectsData.push({
								source: redirect.source,
								destination: redirect.destination,
								permanent: redirect.permanent.title == "Yes" ? true : false
							});
						});
					}
				});
			}
			return redirectsData;
		} catch (error) {
			this.logger.error(`Error converting redirect data`, error.stack);
			throw error;
		}
	}

	async getRedirects(locale: string): Promise<Redirect[]> {
		this.logger.debug(`Fetching redirect components for locale: ${locale}`, this.SERVICE);

		const normalizedUrl = this.baseService.ensureLeadingSlash(locale);
		
		const redirectsJson = await this.cachingService.getFromCache(
			CacheTypes.REDIRECTS,
			normalizedUrl,
		);

		if (redirectsJson) {
			return redirectsJson as Redirect[];
		}
	
		const publicationId = await this.baseService.getPublicationIdByLocale(locale);
		const variables = {
			namespaceId: 1,
			publicationIds: [publicationId],
		};

		const title = this.utilService.getRedirectsSchema();

		let response: any;
		variables['schema'] = { title };
		response = await this.tridionService.query(GET_COMPONENT_LIST2, variables);

		const edges = response.data?.items?.edges;

		if (!edges || edges.length === 0) {
			this.logger.error(`Redireects not found`, this.SERVICE);
			throw new NotFoundException('No Redirects found');
		}

		const redirects = await this.processRedirectsData(edges);

		this.cachingService.putIntoCache(CacheTypes.REDIRECTS, {
			url: normalizedUrl,
			payload: redirects,
		});

		return redirects;
	} catch(error) {
		this.logger.error(`Error fetching Redirects list: ${error.message}`, error.stack, this.SERVICE);
		if (error instanceof NotFoundException || error instanceof BadRequestException) {
			throw error;
		} else {
			throw new InternalServerErrorException(error.message);
		}
	}
}