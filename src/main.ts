import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { configureNestApp } from './app.bootstrap';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureNestApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
