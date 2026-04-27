import { Module } from '@nestjs/common';
import { QuotationsController } from './controllers/quotations.controller';
import { QuotationSectionsController } from './controllers/quotation-sections.controller';
import { QuotationItemsController } from './controllers/quotation-items.controller';
import { QuotationsService } from './services/quotations.service';
import { QuotationSectionsService } from './services/quotation-sections.service';
import { QuotationItemsService } from './services/quotation-items.service';
import { QuotationCalculatorService } from './services/quotation-calculator.service';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [AppConfigModule],
  controllers: [
    QuotationsController,
    QuotationSectionsController,
    QuotationItemsController,
  ],
  providers: [
    QuotationsService,
    QuotationSectionsService,
    QuotationItemsService,
    QuotationCalculatorService,
  ],
  exports: [QuotationsService],
})
export class QuotationsModule {}
