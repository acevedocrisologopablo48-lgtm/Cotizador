import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';

/**
 * Carga perezosa de Nest: evita importar `AppModule` (y dependencias como Puppeteer)
 * al arrancar el proceso, lo que hacía fallar el análisis de despliegue de
 * Cloud Functions (timeout 10s). Ver:
 * https://firebase.google.com/docs/functions/tips#avoid_deployment_timeouts_during_initialization
 */
const server = express();
let nestInitPromise: Promise<void> | null = null;

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

const createNestServer = async (expressInstance: express.Express) => {
  const { NestFactory } = await import('@nestjs/core');
  const { ExpressAdapter } = await import('@nestjs/platform-express');
  const { ValidationPipe } = await import('@nestjs/common');
  const { AppModule } = await import('./app.module');
  const { AllExceptionsFilter } = await import('./common/filters/all-exceptions.filter');

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressInstance));

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

function ensureNestInitialized(): Promise<void> {
  if (!nestInitPromise) {
    nestInitPromise = createNestServer(server)
      .then(() => {
        console.info('[Functions] Nest readiness complete');
      })
      .catch((err) => {
        console.error('[Functions] Nest init error', err instanceof Error ? err.stack : String(err));
        nestInitPromise = null;
        throw err;
      });
  }

  return nestInitPromise;
}

export const api = onRequest(
  {
    memory: '2GiB',
    timeoutSeconds: 120,
    invoker: 'public',
    cors: true,
  },
  async (req, res) => {
    await ensureNestInitialized();
    server(req, res);
  },
);
