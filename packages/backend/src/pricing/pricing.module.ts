import { Module } from '@nestjs/common';
import { CategoriesController } from './controllers/categories.controller';
import { SuppliesController } from './controllers/supplies.controller';
import { PerformanceRatesController } from './controllers/performance-rates.controller';
import { RiskVariablesController } from './controllers/risk-variables.controller';
import { CategoriesService } from './services/categories.service';
import { SuppliesService } from './services/supplies.service';
import { PerformanceRatesService } from './services/performance-rates.service';
import { RiskVariablesService } from './services/risk-variables.service';

@Module({
  controllers: [
    CategoriesController,
    SuppliesController,
    PerformanceRatesController,
    RiskVariablesController,
  ],
  providers: [
    CategoriesService,
    SuppliesService,
    PerformanceRatesService,
    RiskVariablesService,
  ],
  exports: [SuppliesService, PerformanceRatesService, RiskVariablesService],
})
export class PricingModule {}
