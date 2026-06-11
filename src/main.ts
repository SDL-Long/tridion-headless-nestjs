import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { logger } from './common/logger/logger';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'UPDATE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  });

  // add hostname for production build
  const isProduction = process.env.NODE_ENV === 'production';
  const hostname = isProduction ? '0.0.0.0' : 'localhost';

  // integrate swagger
  const config = new DocumentBuilder()
    .setTitle('Middleware Manager Example')
    .setDescription('The Middleware Manager API description')
    .setVersion('1.0')
    //.addTag('middleware') // can modify the api group name
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: 'swagger/json',
  });

  await app.listen(3000, hostname);
}

bootstrap();
