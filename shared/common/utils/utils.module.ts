import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UtilsService } from './utils.service';

@Module({
  providers: [UtilsService, Logger],
  imports: [ConfigModule],
  exports: [UtilsService],
})
export class UtilsModule {}
