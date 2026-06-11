import { Controller, Get, Query } from '@nestjs/common';
import { SitemapService } from './sitemap.service';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { LocaleDto } from '../dto/base.dto';

@Controller('api')
export class SitemapController {
    constructor(private readonly sitemapService: SitemapService) {}
    
    @Get('/sitemap-index.xml')
    @ApiOperation({ summary: 'Get Sitemap Index data' })
	@ApiResponses()
    async getSitemapIndex(): Promise<any> {
        return this.sitemapService.getSitemapIndex();
    }

    @Get('/sitemap.xml')
    @ApiOperation({ summary: 'Get Sitemap data for a particular locale' })
	@ApiResponses()
    async getLocalizedSitemapXml(@Query() localeDto: LocaleDto) {
        return this.sitemapService.generateSitemapXml(localeDto.locale);
    }
}
