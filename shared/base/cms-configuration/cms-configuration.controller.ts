import { Controller, Get, Query } from '@nestjs/common';
import { CmsConfigurationService } from './cms-configuration.service';
import { CmsConfiguration } from '../interfaces/cms-configuration.interface';
import { ComponentDto } from '../dto/component.dto';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller('api')
export class CmsConfigurationController {
  constructor(private readonly cmsConfigurationService: CmsConfigurationService) {}

  @Get('/configurations')
  @ApiOperation({
    summary: 'Get CMS configurations for single or multiple locales',
  })
  @ApiResponses()
  async getCmsConfigurationList(@Query() compDto: ComponentDto): Promise<CmsConfiguration> {
    const data = await this.cmsConfigurationService.getCmsConfigurationList(compDto);
    return data;
  }

  // The single implementation and it has been replaced by the above method /configurations
  @Get('/configuration')
  @ApiExcludeEndpoint()
  async getCmsConfigurations(@Query() compDto: ComponentDto): Promise<CmsConfiguration> {
    const content = await this.cmsConfigurationService.getCmsConfigurations(
      compDto.locale,
      compDto.type,
    );
    return content;
  }
}
