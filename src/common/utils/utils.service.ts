import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UtilsService {
  constructor(private readonly configService: ConfigService) {}

  private pageTemplateRegistry: Record<string, string> = {};

  private componentTemplateRegistry: Record<string, string> = {};

  getDiscoveryServiceUri(): string {
    return this.configService.get<string>('DISCOVERY_SERVICE_URI');
  }

  getServiceTimeout(): number {
    return Number(this.configService.get<string>('HTTP_TIMEOUT', '10'));
  }

  /* getOauthCientId(): string {
    return this.configService.get<string>('OAUTH_CLIENT_ID');
  }

  getOauthCientSecret(): string {
    return this.configService.get<string>('OAUTH_CLIENT_SECRET');
  } */

  getSiteUrl(): string {
    return this.configService.get<string>('SITE_URL');
  }

  getSiteDomain(): string {
    const site_url = this.getSiteUrl();
    const siteParts = site_url.split('/');

    const domain = siteParts[2].split(':')[0];
    return domain;
  }

  getSiteProtocol(): string {
    const site_url = this.getSiteUrl();
    const siteParts = site_url.split('/');

    const protocol = siteParts[0].split(':')[0]; //http or https
    return protocol;
  }

  getSitePort(): string {
    const site_url = this.getSiteUrl();
    const siteParts = site_url.split('/');

    const port = siteParts[2].split(':')[1]; //80 or 8080 or 90
    if (port) {
      return port;
    }
    // No explicit port in SITE_URL: default based on protocol (https -> 443, http -> 80)
    return this.getSiteProtocol() === 'https' ? '443' : '80';
  }

  setPageTemplateRegistry(
    registry: Record<string, string>,
  ) {
    this.pageTemplateRegistry = registry;
  }
  
  setComponentTemplateRegistry(
    registry: Record<string, string>,
  ) {
    this.componentTemplateRegistry = registry;
  }

  getDefaultHeaderPath(): string {
    return this.configService.get('DEFAULT_HEADER_PAGE');
  }

  getDefaultFooterPath(): string {
    return this.configService.get('DEFAULT_FOOTER_PAGE');
  }

  // getPageTemplate(pageTemplateENV: string): string {
  //   return this.configService.get<string>(pageTemplateENV);
  // }

  // getComponentTemplate(compTemplateENV: string): string {
  //   return this.configService.get<string>(compTemplateENV);
  // }

  getPageTemplate(key: string): string {
    return (
      this.pageTemplateRegistry[key] ||
      this.configService.get<string>(key) ||
      'Default'
    );
  }
  
  getComponentTemplate(key: string): string {
    return (
      this.componentTemplateRegistry[key] ||
      this.configService.get<string>(key) ||
      'UnknownComponent'
    );
  }
  
  getDefaultLabelSchema(): string {
    return this.configService.get<string>('LABEL_SCHEMA');
  }

  getDefaultLabelType(): string {
    return this.configService.get<string>('LABEL_TYPE');
  }

  getRedirectsSchema(): string {
    return this.configService.get<string>('REDIRECTS_SCHEMA');
  }

  getDefaultCmsConfigurationType(): string {
    return this.configService.get<string>('CMS_CONFIGURATION_TYPE');
  }

  getNavigationCacheTtl(): number {
    return parseInt(this.configService.get<string>('NAVIGATION_CACHE_TTL') || '3600000', 10);
  }

  getNavigationCacheTtlForCronJob(): number {
    return parseInt(this.configService.get<string>('NAVIGATION_CACHE_TTL_CRONJOB') || '1800000', 10);
  }

  getTaxonomyCacheTtl(): number {
    return parseInt(this.configService.get<string>('TAXONOMY_CACHE_TTL') || '3600000', 10);
  }

  getTaxonomyCacheTtlForCronJob(): number {
    return parseInt(this.configService.get<string>('TAXONOMY_CACHE_TTL_CRONJOB') || '1800000', 10);
  }

  getLabelCacheTtl(): number {
    return parseInt(this.configService.get<string>('LABEL_CACHE_TTL') || '3600000', 10);
  }

  getLabelCacheTtlForCronJob(): number {
    return parseInt(this.configService.get<string>('LABEL_CACHE_TTL_CRONJOB') || '1800000', 10);
  }

  public convertMillisecondsToCron(milliseconds: number): string {
    if (!milliseconds || milliseconds <= 0) {
      throw new Error('Invalid interval: must be > 0');
    }
  
    // Convert milliseconds to seconds
    const seconds = Math.floor(milliseconds / 1000);
  
    // If the interval is less than a minute, run every minute
    if (seconds < 60) {
      const safeSeconds = Math.max(1, seconds);
      return `*/${safeSeconds} * * * * *`;
    }
  
    const minutes = Math.floor(seconds / 60);
  
    // Convert minutes to hours
    if (minutes < 60) {
      const safeMinutes = Math.max(1, minutes);
      return `*/${safeMinutes} * * * *`;
    }
  
    const hours = Math.floor(minutes / 60);
  
    // Run every `hours` if it's more than an hour
    if (hours < 24) {
      const safeHours = Math.max(1, hours);
      return `0 */${safeHours} * * *`;
    }
  
    // Convert hours to days if more than a day
    const days = Math.floor(hours / 24);
  
    // Run daily
    const safeDays = Math.max(1, days);
    return `0 0 */${safeDays} * *`;
  }
}
