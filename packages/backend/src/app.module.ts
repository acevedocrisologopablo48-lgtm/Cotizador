import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { FirebaseModule } from './common/firebase/firebase.module';
import { HealthModule } from './common/health/health.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { PricingModule } from './pricing/pricing.module';
import { QuotationsModule } from './quotations/quotations.module';
import { ProjectsModule } from './projects/projects.module';
import { PettyCashModule } from './petty-cash/petty-cash.module';
import { AppConfigModule } from './app-config/app-config.module';
import { HrModule } from './hr/hr.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    FirebaseModule,
    HealthModule,
    AuthModule,
    ClientsModule,
    PricingModule,
    QuotationsModule,
    ProjectsModule,
    PettyCashModule,
    AppConfigModule,
    HrModule,
    TelegramModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
