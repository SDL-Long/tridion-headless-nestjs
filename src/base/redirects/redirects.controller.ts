import { Controller, Get, Query } from '@nestjs/common';
import { RedirectsService } from './redirects.service';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { LocaleDto } from '../dto/base.dto';
import { Redirect } from '../interfaces/redirects.interface';

@Controller('api')
export class RedirectsController {
	constructor(private readonly redirectsService: RedirectsService) { }

	// request url - /redirects?locale=en-us,
	@Get('/redirects')
	@ApiOperation({ summary: 'Get Dynamic Redirects for a particular locale' })
	@ApiResponses()
	async getRedirects(@Query() localeDto: LocaleDto): Promise<Redirect[]> {
		return this.redirectsService.getRedirects(localeDto.locale);
	}
}