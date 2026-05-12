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
  paternalLastName?: string;
  maternalLastName?: string;
  names?: string;
  birthDate?: string;
  gender?: string;
  civilStatus?: string;
  childrenCount?: number;
  address?: string;
  mainSkills?: string;
  medicalNotes?: string;
  hasDriverLicense?: boolean;
  driverLicense?: string;
  bankName?: string;
  bankAccountNumber?: string;
  cci?: string;
  accountType?: string;
  yapePlinNumber?: string;
  shoeSize?: string;
  shirtSize?: string;
  pantsSize?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactPhone2?: string;
  inductionPassed?: boolean;
  safetyDocumentsDelivered?: boolean;
  sctrSalary?: number;
  personnelGroup?: 'CURRENT' | 'BACKUP' | string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  type: AttendanceType;
  timestamp: string;
  actualTimestamp?: string;
  roundedTimestamp?: string;
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
  actualCheckInTime?: string | null;
  checkOutTime?: string | null;
  actualCheckOutTime?: string | null;
  hoursWorked?: number | null;
  regularHours?: number | null;
  overtimeHours?: number | null;
  paidDays?: number | null;
  permissionStatus?: 'PENDING' | 'APPROVED' | 'DENIED' | string;
  permissionReason?: string;
  status: TimesheetStatus;
  employee?: Employee | null;
  checkInAttendance?: Attendance | null;
  checkOutAttendance?: Attendance | null;
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
