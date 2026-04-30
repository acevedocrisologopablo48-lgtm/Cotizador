import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Health & readiness endpoints. No requieren auth.
 * Útil para monitoreo (Railway/Cloud Functions/Uptime).
 */
@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @SkipThrottle()
  health() {
    return {
      status: 'ok',
      service: 'cotizador-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @SkipThrottle()
  ready() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}
