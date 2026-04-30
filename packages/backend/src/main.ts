import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const bootstrapLogger = new Logger('Bootstrap');

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const config = new DocumentBuilder()
    .setTitle('Cotizador API')
    .setDescription('API del Sistema de Gestión de Cotizaciones y Costos — FYM Technologies')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.BACKEND_PORT || 3001;
  await app.listen(port);
  bootstrapLogger.log(`Cotizador API running on http://localhost:${port}`);
  bootstrapLogger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
