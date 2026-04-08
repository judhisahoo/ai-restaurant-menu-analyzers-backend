import 'dotenv/config';
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
const swaggerUiDist = require('swagger-ui-dist');

async function bootstrap() {
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Restaurant Menu AI Backend')
    .setDescription(
      'REST API for the restaurant menu scan thesis workflow: scan menu, process AI menu items, view dish components, and open ingredient details.',
    )
    .setVersion('1.0.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  const swaggerAssetsPath = swaggerUiDist.getAbsoluteFSPath();
  app.use('/api/docs/docs', express.static(swaggerAssetsPath));
  app.use('/api/docs', express.static(swaggerAssetsPath));

  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
    swaggerOptions: {
      url: '/api/docs-json',
    },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
