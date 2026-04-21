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
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  INVOICED = 'INVOICED',
}

export const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.DRAFT]: [QuotationStatus.REVIEW],
  [QuotationStatus.REVIEW]: [QuotationStatus.DRAFT, QuotationStatus.SENT],
  [QuotationStatus.SENT]: [QuotationStatus.APPROVED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED],
  [QuotationStatus.APPROVED]: [QuotationStatus.INVOICED],
  [QuotationStatus.REJECTED]: [QuotationStatus.DRAFT],
  [QuotationStatus.EXPIRED]: [QuotationStatus.DRAFT],
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
