import { Module } from '@nestjs/common';
import { CompaniesController } from './controllers/companies.controller';
import { ContactsController } from './controllers/contacts.controller';
import { AgreementsController } from './controllers/agreements.controller';
import { CompaniesService } from './services/companies.service';
import { ContactsService } from './services/contacts.service';
import { AgreementsService } from './services/agreements.service';

@Module({
  controllers: [CompaniesController, ContactsController, AgreementsController],
  providers: [CompaniesService, ContactsService, AgreementsService],
  exports: [CompaniesService],
})
export class ClientsModule {}
