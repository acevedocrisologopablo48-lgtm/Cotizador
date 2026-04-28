import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import express from 'express';
import * as functions from 'firebase-functions';

const server = express();

export const createNestServer = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: true, // For production, you might want to restrict this
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app.init();
};

createNestServer(server)
  .then(() => console.log('Nest Readiness Complete'))
  .catch((err) => console.error('Nest Init Error', err));

import { onRequest } from 'firebase-functions/v2/https';

// Export the cloud function with v2
export const api = onRequest({
  memory: '512MiB',
  timeoutSeconds: 60,
  invoker: 'public',
  cors: true,
}, server);
