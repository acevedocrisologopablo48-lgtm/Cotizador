import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { FirebaseModule } from './common/firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { PricingModule } from './pricing/pricing.module';
import { QuotationsModule } from './quotations/quotations.module';
import { ProjectsModule } from './projects/projects.module';
import { PettyCashModule } from './petty-cash/petty-cash.module';
import { AppConfigModule } from './app-config/app-config.module';
import { HrModule } from './hr/hr.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    FirebaseModule,
    AuthModule,
    ClientsModule,
    PricingModule,
    QuotationsModule,
    ProjectsModule,
    PettyCashModule,
    AppConfigModule,
    HrModule,
  ],
  providers: [],
})
export class AppModule {}
