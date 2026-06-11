import { Controller, Get, Query } from '@nestjs/common';
import { LabelService } from './label.service';
import { Label } from '../interfaces/label.interface';
import { ComponentDto } from '../dto/component.dto';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller('api')
export class LabelController {
  constructor(private readonly labelsService: LabelService) {}

  @Get('/labelsBySchemaOrItemTypes')
  @ApiOperation({ summary: 'Get CMS labels for single or multiple locales' })
  @ApiResponses()
  async getLabelsBySchemaOrItemTypes(@Query() compDto: ComponentDto): Promise<Label> {
    const data = await this.labelsService.getLabelsBySchemaOrItemTypes(compDto);
    return data;
  }

  // request url - /labels?locale=en-us&type=COMMON,CUSTOM,
  @Get('/labels')
  @ApiOperation({ summary: 'Get CMS labels for single or multiple locales' })
  @ApiResponses()
  async getLabelList(@Query() compDto: ComponentDto): Promise<Label> {
    const data = await this.labelsService.getLabelList(compDto);
    return data;
  }

  // The single implementation and it has been replaced by the above method /labels
  @Get('/label')
  @ApiExcludeEndpoint()
  async getLabel(@Query() compDto: ComponentDto): Promise<Label> {
    const content = await this.labelsService.getLabel(compDto.locale, compDto.type);
    return content;
  }
}
