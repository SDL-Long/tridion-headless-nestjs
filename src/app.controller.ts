import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiResponses } from './common/swagger/api-responses.decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiResponses()
  @ApiOperation({ summary: 'Welcome to the middleware application' })
  async getWelcomeInfo() {
    return "Welcome to the middleware application";
  }
}
