/**
 * Datos de cotización extraídos por Gemini desde un audio/texto de Telegram.
 */
export interface QuotationDraft {
  /** Título o descripción corta del trabajo */
  title: string;
  /** Nombre de la empresa mencionada (para fuzzy matching) */
  companyName: string;
  /** Nombre del contacto si lo mencionaron */
  contactName?: string;
  /** Descripción más detallada del trabajo */
  description?: string;
  /** Monto total mencionado */
  manualTotal?: number;
  /** Moneda: PEN o USD */
  currency?: 'PEN' | 'USD';
  /** Lugar de ejecución */
  executionLocation?: string;
  /** Plazo de entrega en días */
  deliveryTimeDays?: number;
  /** Días de validez */
  validityDays?: number;
  /** Confianza del modelo (0-1) */
  confidence: number;
  /** Campos que el modelo no pudo extraer */
  missingFields: string[];
}

/**
 * Estado de una conversación activa del bot con un usuario.
 */
export type ConversationStatus = 'IDLE' | 'EXTRACTING' | 'ASKING' | 'CONFIRMING';

export interface ConversationState {
  status: ConversationStatus;
  draft: Partial<QuotationDraft>;
  /** companyId resuelto desde Firestore (null si no fue posible resolver) */
  resolvedCompanyId?: string | null;
  /** contactId resuelto desde Firestore (null si no fue posible resolver) */
  resolvedContactId?: string | null;
  /** Campos obligatorios aún faltantes */
  missingFields: string[];
  /** Firebase UID vinculado a este chatId */
  linkedUserId: string;
  lastActivity: Date;
}

/**
 * Configuración de Telegram almacenada en Firestore (config/telegram).
 */
export interface TelegramConfig {
  enabled: boolean;
  /** Mapa chatId → Firebase UID */
  authorizedChatIds: Record<string, string>;
  maxQuotationsPerHour: number;
}
