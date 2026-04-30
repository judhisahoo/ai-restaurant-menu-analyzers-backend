import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { configureNestApp } from '../src/app.bootstrap';
import { AppModule } from '../src/app.module';

let cachedServer: express.Express | undefined;

async function createServer(): Promise<express.Express> {
  try {
    const server = express();

    console.log('Creating Nest app...');

    const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    console.log('Configuring Nest app...');
    configureNestApp(app);

    console.log('Initializing Nest app...');
    await app.init();

    console.log('Nest app initialized');

    return server;
  } catch (error) {
    console.error('Nest bootstrap failed:', error);
    throw error;
  }
}

export default async function handler(request: any, response: any) {
  try {
    cachedServer ??= await createServer();
    return cachedServer(request, response);
  } catch (error) {
    console.error('Handler failed:', error);

    return response.status(500).json({
      message: 'NestJS handler failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}