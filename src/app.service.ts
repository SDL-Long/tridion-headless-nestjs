import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseService } from './base/base.service';
import { TridionService } from './common/graphql/tridion.service';
import { NavigationService } from './base/navigation/navigation.service';
import { TaxonomyService } from './base/taxonomy/taxonomy.service';
import { LabelService } from './base/label/label.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly tridionService: TridionService,
    private readonly baseService: BaseService,
    private readonly taxonomyService: TaxonomyService,
    private readonly navigationService: NavigationService,
    private readonly labelService: LabelService
  ) {}

  async onModuleInit() {
    await this.tridionService.initialize();
    await this.baseService.initialize();
    
    await this.taxonomyService.initialize();
    await this.navigationService.initialize();
    await this.labelService.initialize();
  }
}
