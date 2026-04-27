import type {
  AttendanceType,
  DocumentType,
  EmployeeStatus,
  TimesheetStatus,
} from '@fym/shared';

// ─── HR module shared types ───────────────────────────────────────────────────

export interface Employee {
  id: string;
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  position: string;
  department: string;
  startDate: string;
  status: EmployeeStatus;
  phone?: string;
  email?: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  type: AttendanceType;
  timestamp: string;
  photoUrl: string;
  date: string;
  location?: { lat: number; lng: number } | null;
  notes?: string | null;
  registeredBy: string;
  createdAt: string;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  date: string;
  month: string;
  week: string;
  checkInId: string;
  checkOutId?: string | null;
  checkInTime: string;
  checkOutTime?: string | null;
  hoursWorked?: number | null;
  status: TimesheetStatus;
  employee?: Employee | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetSummary {
  employee: Employee;
  daysPresent: number;
  daysIncomplete: number;
  daysAbsent: number;
  totalHours: number;
  records: Timesheet[];
}
