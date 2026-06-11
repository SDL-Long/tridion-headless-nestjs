import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { NavigationService } from '../navigation/navigation.service';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import * as CONSTANTS from '../../constants';
import { NavigationNode } from '../interfaces/navigationNode.interface';

@Injectable()
export class SitemapService {
  constructor(
      private readonly cachingService: CachingService,
      private readonly navigationService: NavigationService
  ) {}

  async getSitemapIndex() {
    const cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);
  
    if (!cachedLocalizations) {
      throw new InternalServerErrorException(CONSTANTS.ERROR_LOCALIZATIONS_NOT_FOUND);
    }
  
    const locales = cachedLocalizations.map((localization: any) => {
      const loc = `${localization.path}/sitemap.xml`;
  
      return {
        loc,
      };
    });
  
    return {
      sitemapindex: locales,
    };
  }

  async generateSitemapXml(locale: string) {
    const navigationData: NavigationNode = await this.navigationService.getNavigation(locale);

    return this.extractSitemapEntries(navigationData);
  }

  extractSitemapEntries(node: NavigationNode): { url: string; lastmod: string }[] {
    let entries: { url: string; lastmod: string }[] = [];
  
    if (node.includeInSitemap && node.url && node.lastPublishedDate) {
      entries.push({ url: node.url, lastmod: node.lastPublishedDate });
    }
  
    if (node.children) {
      for (const child of node.children) {
        entries = entries.concat(this.extractSitemapEntries(child));
      }
    }
  
    return entries;
  }
}

