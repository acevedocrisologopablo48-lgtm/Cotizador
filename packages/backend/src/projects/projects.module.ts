import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectExpensesController } from './controllers/project-expenses.controller';
import { ProjectWorkforceController } from './controllers/project-workforce.controller';
import { ProjectEquipmentController } from './controllers/project-equipment.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectExpensesService } from './services/project-expenses.service';
import { ProjectWorkforceService } from './services/project-workforce.service';
import { ProjectEquipmentService } from './services/project-equipment.service';

@Module({
  controllers: [
    ProjectsController,
    ProjectExpensesController,
    ProjectWorkforceController,
    ProjectEquipmentController,
  ],
  providers: [
    ProjectsService,
    ProjectExpensesService,
    ProjectWorkforceService,
    ProjectEquipmentService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
