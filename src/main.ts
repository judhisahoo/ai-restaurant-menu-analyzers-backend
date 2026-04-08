import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { AppModule } from './app.module';
import {
  ensureApplicationDirectories,
  resolveUploadRoot,
} from './common/utils/app-paths.util';

async function bootstrap() {
  ensureApplicationDirectories();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.use('/uploads', express.static(resolveUploadRoot()));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Restaurant Menu AI Backend')
    .setDescription(
      'REST API for the restaurant menu scan thesis workflow: scan menu, process AI menu items, view dish components, and open ingredient details.',
    )
    .setVersion('1.0.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);
  app.getHttpAdapter().get('/api/docs-json', (_request, response) => {
    response.json(swaggerDocument);
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
