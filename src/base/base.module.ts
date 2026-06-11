import { Module, Logger } from '@nestjs/common';
import { BaseController } from './base.controller';
import { BaseService } from './base.service';
import { LabelService } from './label/label.service';
import { CommonModule } from '../common/common.module';
import { PageController } from './page/page.controller';
import { ComponentController } from './component/component.controller';
import { LabelController } from './label/label.controller';
import { TaxonomyController } from './taxonomy/taxonomy.controller';
import { PageService } from './page/page.service';
import { ComponentService } from './component/component.service';
import { TaxonomyService } from './taxonomy/taxonomy.service';
import { BinaryController } from './binary/binary.controller';
import { BinaryService } from './binary/binary.service';
import { NavigationService } from './navigation/navigation.service';
import { NavigationController } from './navigation/navigation.controller';
import { CmsConfigurationController } from './cms-configuration/cms-configuration.controller';
import { CmsConfigurationService } from './cms-configuration/cms-configuration.service';
import { ConfigModule } from '@nestjs/config';
import { RedirectsController } from './redirects/redirects.controller';
import { RedirectsService } from './redirects/redirects.service';
import { SitemapController } from './sitemap/sitemap.controller';
import { SitemapService } from './sitemap/sitemap.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  controllers: [
    BaseController,
    LabelController,
    TaxonomyController,
    PageController,
    ComponentController,
    BinaryController,
    NavigationController,
    CmsConfigurationController,
    RedirectsController,
    SitemapController,
  ],
  providers: [
    BaseService,
    LabelService,
    TaxonomyService,
    PageService,
    ComponentService,
    BinaryService,
    NavigationService,
    CmsConfigurationService,
    Logger,
    RedirectsService,
    SitemapService,
  ],
  imports: [CommonModule, ConfigModule, ScheduleModule],
  exports: [
    BaseService,
    LabelService,
    TaxonomyService,
    PageService,
    ComponentService,
    BinaryService,
    NavigationService,
    CmsConfigurationService,
    RedirectsService,
    SitemapService,
  ],
})
export class BaseModule {}
