import { auth } from './firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: 'Datos inválidos. Verifica la información ingresada.',
  401: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'Ya existe un registro con esa información.',
  422: 'Los datos enviados no son válidos.',
  429: 'Demasiadas solicitudes. Intenta más tarde.',
  500: 'Error del servidor. Intenta más tarde.',
  502: 'El servidor no está disponible. Intenta más tarde.',
  503: 'Servicio temporalmente no disponible. Intenta más tarde.',
};

interface FetchOptions extends RequestInit {
  token?: string; // Optional override
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };

  // Try to use the passed token, or fall back to the current Firebase user token
  let authToken = token;
  if (!authToken && auth.currentUser) {
    try {
      authToken = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn("Failed to get Firebase token for API call", e);
    }
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...rest, headers });
  } catch {
    throw new Error('Sin conexión. Verifica tu conexión a internet.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // Backend may return { message: string | string[] }
    const backendMsg = body?.message;
    const fallback = HTTP_ERROR_MESSAGES[res.status] ?? `Error inesperado (${res.status})`;
    const message = Array.isArray(backendMsg)
      ? backendMsg[0]
      : typeof backendMsg === 'string' && backendMsg.trim()
      ? backendMsg
      : fallback;
    throw new Error(message);
  }

  return res.json();
}

/**
 * Helper para descargar un archivo binario autenticado (xlsx, pdf, etc.).
 * Reutiliza el manejo de Authorization/Firebase token y traduce errores HTTP
 * a mensajes en español, igual que el resto del cliente `api`.
 */
async function apiDownload(
  endpoint: string,
  filename: string,
  options: { token?: string; method?: string; body?: unknown } = {},
): Promise<void> {
  const { token, method = 'GET', body } = options;

  const headers: Record<string, string> = {};

  let authToken = token;
  if (!authToken && auth.currentUser) {
    try {
      authToken = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('Failed to get Firebase token for download', e);
    }
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Sin conexión. Verifica tu conexión a internet.');
  }

  if (!res.ok) {
    // Cuando el backend devuelve JSON con `message`, intentamos extraerlo;
    // si no, usamos el mapa estándar.
    let message = HTTP_ERROR_MESSAGES[res.status] ?? `Error inesperado (${res.status})`;
    try {
      const json = await res.json();
      const backendMsg = json?.message;
      if (Array.isArray(backendMsg)) message = backendMsg[0] ?? message;
      else if (typeof backendMsg === 'string' && backendMsg.trim()) message = backendMsg;
    } catch {
      /* el body no es JSON: mantenemos el fallback */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function apiDownloadPdf(
  endpoint: string,
  filename: string,
  token?: string,
): Promise<void> {
  const headers: Record<string, string> = {};

  let authToken = token;
  if (!authToken && auth.currentUser) {
    try {
      authToken = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('Failed to get Firebase token for PDF download', e);
    }
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { method: 'GET', headers });
  } catch {
    throw new Error('Sin conexión. Verifica tu conexión a internet.');
  }

  if (!res.ok) {
    let json: Record<string, unknown> | null = null;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      json = null;
    }
    if (res.status === 400 && json && Array.isArray(json.warnings)) {
      const msg =
        typeof json.message === 'string' && json.message.trim()
          ? json.message
          : 'Documento incompleto';
      const err = new Error(msg) as Error & { warnings: string[] };
      err.warnings = json.warnings as string[];
      throw err;
    }
    let message = HTTP_ERROR_MESSAGES[res.status] ?? `Error inesperado (${res.status})`;
    const backendMsg = json?.message;
    if (Array.isArray(backendMsg)) message = String(backendMsg[0] ?? message);
    else if (typeof backendMsg === 'string' && backendMsg.trim()) message = backendMsg;
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const api = {
  get: <T>(endpoint: string, token?: string) =>
    apiFetch<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, body: unknown, token?: string) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(body), token }),

  put: <T>(endpoint: string, body: unknown, token?: string) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(body), token }),

  patch: <T>(endpoint: string, body: unknown, token?: string) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), token }),

  delete: <T>(endpoint: string, token?: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE', token }),

  download: (endpoint: string, filename: string, token?: string) =>
    apiDownload(endpoint, filename, { token }),

  downloadPost: (endpoint: string, body: unknown, filename: string, token?: string) =>
    apiDownload(endpoint, filename, { token, method: 'POST', body }),

  downloadQuotationPdf: (quotationId: string, filename: string, token?: string, force = false) =>
    apiDownloadPdf(`/quotations/${quotationId}/pdf${force ? '?force=true' : ''}`, filename, token),
};
