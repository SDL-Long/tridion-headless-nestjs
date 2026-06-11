import { Controller, Get, Query } from '@nestjs/common';
import { LocaleDto } from '../dto/base.dto';
import { Base } from '../interfaces/base.interface';
import { NavigationService } from './navigation.service';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller('api')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('/navigation')
  @ApiOperation({ summary: 'Get navigation details of publication/locale' })
  @ApiResponses()
  async handleNavigation(@Query() localeDto: LocaleDto): Promise<Base> {
    const data = await this.navigationService.getNavigation(localeDto.locale);
    return data;
  }
}
