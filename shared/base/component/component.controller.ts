import { Controller, Get, Query } from '@nestjs/common';
import { ComponentService } from './component.service';
import { BaseDto } from '../dto/base.dto';
import { ComponentDto } from '../dto/component.dto';
import { Component, Components } from '../interfaces/base.interface';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import { ComponentListDto } from '../dto/componentList.dto';

@Controller('api')
export class ComponentController {
  constructor(private readonly componentService: ComponentService) {}

  @Get('/components')
  @ApiOperation({ summary: 'Get component data' })
  @ApiResponses()
  async handleComponents(@Query() compDto: ComponentDto): Promise<Components> {
    const data = await this.componentService.getComponentList(compDto);
    return data;
  }

  @Get('/componentmeta')
  @ApiExcludeEndpoint()
  async handleComponentMetadata(@Query() baseDto: BaseDto): Promise<Component> {
    const data = await this.componentService.getComponentMetadata(baseDto.url);
    return data;
  }

  // The single implementation and it has been replaced by the above method /components
  @Get('/component')
  @ApiExcludeEndpoint()
  async handleComponent(@Query() baseDto: BaseDto): Promise<Component> {
    const data = await this.componentService.getComponent(baseDto.url);
    return data;
  }

  @Get('/componentBySchemaAndType')
  @ApiOperation({ summary: 'Get component data' })
  @ApiResponses()
  async fetchComponentListBySchemaAndType(
    @Query() componentDto: ComponentListDto,
  ): Promise<Components> {
    const data = await this.componentService.getComponentListBySchemaAndType(componentDto);
    return data;
  }

  @Get('/componentByCriteria')
  @ApiOperation({ summary: 'Get promotion component data' })
  @ApiResponses()
  async fetchComponentListByCriteria(
    @Query() componentDto: ComponentListDto,
  ): Promise<Components> {
    const maxTotal = componentDto.maxTotal;
    const data = await (maxTotal && maxTotal > 0 ? this.componentService.getMaxTotalComponentListByCriteria(componentDto) : this.componentService.getComponentListByCriteria(componentDto));
    return data;
  }
}
