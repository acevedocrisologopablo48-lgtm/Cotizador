export const SCHEDULE_FACTORS = {
  DIURNAL: 1.0,
  NOCTURNAL: 1.35,
  HOLIDAY: 2.0,
};

export const HEIGHT_THRESHOLD_METERS = 1.8;
export const HEIGHT_EFFICIENCY_FACTOR = 1.25;

export const SST_RISK_CONFIG = {
  LOW: {
    includeBasicEPP: true,
    includeSCTR: false,
    includeEMO: false,
    includeIPERC: false,
  },
  MEDIUM: {
    includeBasicEPP: true,
    includeSCTR: true,
    includeEMO: false,
    includeIPERC: false,
  },
  HIGH: {
    includeBasicEPP: true,
    includeSCTR: true,
    includeEMO: true,
    includeIPERC: true,
  },
};

export const IGV_PERCENTAGE = 18;
export const DEFAULT_QUOTATION_VALIDITY_DAYS = 15;
export const QUOTATION_NUMBER_PREFIX = 'COT';
export const PROJECT_CODE_PREFIX = 'PRY';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MAX_FILE_SIZE_MB = 10;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export const ACCESS_TOKEN_COOKIE = 'fym_access_token';
export const REFRESH_TOKEN_COOKIE = 'fym_refresh_token';

export const RATE_LIMIT_DEFAULT = { ttl: 60_000, limit: 100 };
export const RATE_LIMIT_EXPORT = { ttl: 60_000, limit: 10 };

export const DEFAULT_GENERAL_EXPENSES_PERCENTAGE = 10;
export const DEFAULT_PROFIT_MARGIN_PERCENTAGE = 15;
