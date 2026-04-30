import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectExpensesController } from './controllers/project-expenses.controller';
import { ProjectWorkforceController } from './controllers/project-workforce.controller';
import { ProjectEquipmentController } from './controllers/project-equipment.controller';
import { ProjectTasksController, ProjectTasksDirectController } from './controllers/project-tasks.controller';
import { ProjectMilestonesController, ProjectMilestonesDirectController } from './controllers/project-milestones.controller';
import { ProjectActivityController } from './controllers/project-activity.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectExpensesService } from './services/project-expenses.service';
import { ProjectWorkforceService } from './services/project-workforce.service';
import { ProjectEquipmentService } from './services/project-equipment.service';
import { ProjectTasksService } from './services/project-tasks.service';
import { ProjectMilestonesService } from './services/project-milestones.service';
import { ProjectActivityService } from './services/project-activity.service';

@Module({
  controllers: [
    ProjectsController,
    ProjectExpensesController,
    ProjectWorkforceController,
    ProjectEquipmentController,
    ProjectTasksController,
    ProjectTasksDirectController,
    ProjectMilestonesController,
    ProjectMilestonesDirectController,
    ProjectActivityController,
  ],
  providers: [
    ProjectsService,
    ProjectExpensesService,
    ProjectWorkforceService,
    ProjectEquipmentService,
    ProjectTasksService,
    ProjectMilestonesService,
    ProjectActivityService,
  ],
  exports: [ProjectsService, ProjectTasksService, ProjectMilestonesService],
})
export class ProjectsModule {}
