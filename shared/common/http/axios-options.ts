import { ConfigModule, ConfigService } from '@nestjs/config';
//import axiosRetry from 'axios-retry'; //todo

export const AxiosOptions = {
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    timeout: Number(configService.get<string>('HTTP_TIMEOUT', '10000')),
    maxRedirects: Number(configService.get<string>('HTTP_MAX_REDIRECTS', '5')),
  }),
  inject: [ConfigService],
};
