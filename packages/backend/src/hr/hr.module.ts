import { Module } from '@nestjs/common';
import { EmployeesController } from './controllers/employees.controller';
import { AttendancesController } from './controllers/attendances.controller';
import { TimesheetsController } from './controllers/timesheets.controller';
import { EmployeesService } from './services/employees.service';
import { AttendancesService } from './services/attendances.service';
import { TimesheetsService } from './services/timesheets.service';

@Module({
  controllers: [
    EmployeesController,
    AttendancesController,
    TimesheetsController,
  ],
  providers: [
    EmployeesService,
    AttendancesService,
    TimesheetsService,
  ],
  exports: [
    EmployeesService,
    AttendancesService,
    TimesheetsService,
  ],
})
export class HrModule {}
