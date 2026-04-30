export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ENGINEER = 'ENGINEER',
  FIELD_SUPERVISOR = 'FIELD_SUPERVISOR',
  ACCOUNTANT = 'ACCOUNTANT',
  VIEWER = 'VIEWER',
}

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  SENT = 'SENT',
  FOLLOW_UP = 'FOLLOW_UP',
  STAND_BY = 'STAND_BY',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  INVOICED = 'INVOICED',
}

export const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.DRAFT]: [QuotationStatus.REVIEW],
  [QuotationStatus.REVIEW]: [QuotationStatus.DRAFT, QuotationStatus.SENT],
  [QuotationStatus.SENT]: [QuotationStatus.APPROVED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED, QuotationStatus.FOLLOW_UP, QuotationStatus.STAND_BY],
  [QuotationStatus.FOLLOW_UP]: [QuotationStatus.APPROVED, QuotationStatus.REJECTED, QuotationStatus.STAND_BY, QuotationStatus.SENT],
  [QuotationStatus.STAND_BY]: [QuotationStatus.FOLLOW_UP, QuotationStatus.SENT, QuotationStatus.REJECTED],
  [QuotationStatus.APPROVED]: [QuotationStatus.INVOICED],
  [QuotationStatus.REJECTED]: [QuotationStatus.DRAFT, QuotationStatus.FOLLOW_UP],
  [QuotationStatus.EXPIRED]: [QuotationStatus.DRAFT, QuotationStatus.FOLLOW_UP],
  [QuotationStatus.INVOICED]: [],
};

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum SupplyType {
  MATERIAL = 'MATERIAL',
  EQUIPMENT_RENTAL = 'EQUIPMENT_RENTAL',
  EQUIPMENT_PURCHASE = 'EQUIPMENT_PURCHASE',
  LABOR = 'LABOR',
  SUBCONTRACT = 'SUBCONTRACT',
}

export enum UnitOfMeasure {
  UND = 'UND',
  M2 = 'M2',
  M3 = 'M3',
  ML = 'ML',
  KG = 'KG',
  HR = 'HR',
  DIA = 'DIA',
  GLB = 'GLB',
  PZA = 'PZA',
  BTU = 'BTU',
  TON = 'TON',
}

export enum Specialty {
  CIVIL = 'CIVIL',
  METALWORK = 'METALWORK',
  ELECTRICAL = 'ELECTRICAL',
  HVAC = 'HVAC',
  PLUMBING = 'PLUMBING',
  GENERAL = 'GENERAL',
}

export enum RiskVariableType {
  SCHEDULE = 'SCHEDULE',
  HEIGHT_RISK = 'HEIGHT_RISK',
  SAFETY_SST = 'SAFETY_SST',
  LOCATION = 'LOCATION',
  URGENCY = 'URGENCY',
}

export enum ExpenseCategory {
  MATERIAL = 'MATERIAL',
  EQUIPMENT = 'EQUIPMENT',
  LABOR = 'LABOR',
  SUBCONTRACT = 'SUBCONTRACT',
  TRANSPORT = 'TRANSPORT',
  FOOD = 'FOOD',
  OTHER = 'OTHER',
}

export enum TaxDocumentType {
  FACTURA = 'FACTURA',
  BOLETA = 'BOLETA',
  RECIBO = 'RECIBO',
  NONE = 'NONE',
}

export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CREDIT = 'CREDIT',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
}

export enum Currency {
  PEN = 'PEN',
  USD = 'USD',
}

export enum PettyCashStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  RECONCILING = 'RECONCILING',
}

export enum PettyCashTransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  REFUND = 'REFUND',
}

export enum ScheduleType {
  DIURNAL = 'DIURNAL',
  NOCTURNAL = 'NOCTURNAL',
  HOLIDAY = 'HOLIDAY',
}

export enum SSTRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum WorkerRole {
  CAPATAZ = 'CAPATAZ',
  OPERARIO = 'OPERARIO',
  OFICIAL = 'OFICIAL',
  PEON = 'PEON',
  TECNICO_ESPECIALISTA = 'TECNICO_ESPECIALISTA',
}

export enum RentalType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

export enum CategoryModuleType {
  MATERIAL = 'MATERIAL',
  EQUIPMENT = 'EQUIPMENT',
  LABOR = 'LABOR',
  SERVICE = 'SERVICE',
}

// ─── RRHH ────────────────────────────────────────────────────────────────────

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum DocumentType {
  DNI = 'DNI',
  CE = 'CE',
  PASAPORTE = 'PASAPORTE',
}

export enum AttendanceType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}

export enum TimesheetStatus {
  PRESENT = 'PRESENT',
  INCOMPLETE = 'INCOMPLETE',
  ABSENT = 'ABSENT',
}

// ─── Gestión de Proyectos (Tareas, Hitos, Kanban) ────────────────────────────

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'Por Hacer',
  [TaskStatus.IN_PROGRESS]: 'En Progreso',
  [TaskStatus.IN_REVIEW]: 'En Revisión',
  [TaskStatus.DONE]: 'Completado',
};

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'Baja',
  [TaskPriority.MEDIUM]: 'Media',
  [TaskPriority.HIGH]: 'Alta',
  [TaskPriority.URGENT]: 'Urgente',
};

export enum MilestoneStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  [MilestoneStatus.PENDING]: 'Pendiente',
  [MilestoneStatus.COMPLETED]: 'Completado',
  [MilestoneStatus.OVERDUE]: 'Vencido',
};

export enum ProjectActivityAction {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DELETED = 'TASK_DELETED',
  MILESTONE_CREATED = 'MILESTONE_CREATED',
  MILESTONE_COMPLETED = 'MILESTONE_COMPLETED',
  MILESTONE_UPDATED = 'MILESTONE_UPDATED',
  PROJECT_STATUS_CHANGED = 'PROJECT_STATUS_CHANGED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
}
