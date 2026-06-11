import { Controller, Get, Query } from '@nestjs/common';
import { PageService } from './page.service';
import { BaseDto, LocaleDto } from '../dto/base.dto';
import { Base } from '../interfaces/base.interface';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller('api')
export class PageController {
  constructor(private readonly pageService: PageService) {}

  @Get('/page')
  @ApiResponses()
  @ApiOperation({ summary: 'Get page data by url' })
  async handlePage(@Query() baseDto: BaseDto): Promise<Base> {
    const data = await this.pageService.getPageData(baseDto.url);
    return data;
  }

  @Get('/pagemeta')
  @ApiResponses()
  @ApiOperation({ summary: 'Get page metadata by url' })
  async handlePageMetadata(@Query() baseDto: BaseDto): Promise<Base> {
    const data = await this.pageService.getPageMetadata(baseDto.url);
    return data;
  }

  @Get('/defaultHeader')
  @ApiResponses()
  @ApiOperation({ summary: 'Get default header based on publication locale' })
  async handleDefaultHeader(@Query() localeDto: LocaleDto): Promise<Base> {
    const data = await this.pageService.getDefaultHeader(localeDto.locale, false);
    return data;
  }

  @Get('/defaultFooter')
  @ApiResponses()
  @ApiOperation({ summary: 'Get default footer based on publication locale' })
  async handleDefaultFooter(@Query() localeDto: LocaleDto): Promise<Base> {
    const data = await this.pageService.getDefaultFooter(localeDto.locale, false);
    return data;
  }

  @Get('/header')
  @ApiResponses()
  @ApiOperation({ summary: 'Get header by url' })
  async handleHeader(@Query() baseDto: BaseDto): Promise<Base> {
    const data = await this.pageService.getHeader(baseDto.url);
    return data;
  }

  @Get('/footer')
  @ApiResponses()
  @ApiOperation({ summary: 'Get footer by url' })
  async handleFooter(@Query() baseDto: BaseDto): Promise<Base> {
    const data = await this.pageService.getFooter(baseDto.url);
    return data;
  }
}
