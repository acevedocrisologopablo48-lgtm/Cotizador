import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const logger = new Logger('Functions');
const server = express();

/**
 * Construye la lista de orígenes permitidos a partir de variables de entorno.
 * Acepta un patrón fallback para previews de Vercel (`fym-cotizaciones-*.vercel.app`).
 */
function buildAllowedOrigins(): Array<string | RegExp> {
  const env = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const baseline: Array<string | RegExp> = [
    'http://localhost:3000',
    'https://cotiza-luis.web.app',
    'https://cotiza-luis.firebaseapp.com',
    'https://fym-cotizaciones.vercel.app',
    /^https:\/\/fym-cotizaciones-.*\.vercel\.app$/,
  ];

  return Array.from(new Set([...baseline, ...env]));
}

export const createNestServer = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: buildAllowedOrigins(),
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
  .then(() => logger.log('Nest readiness complete'))
  .catch((err) => logger.error('Nest init error', err instanceof Error ? err.stack : String(err)));

// Export the cloud function with v2.
// `cors: true` mantiene compat con preflights manejados por Express; el ACL real
// vive en `enableCors(buildAllowedOrigins())`, que Nest aplica al request.
export const api = onRequest({
  memory: '512MiB',
  timeoutSeconds: 60,
  invoker: 'public',
  cors: true,
}, server);
