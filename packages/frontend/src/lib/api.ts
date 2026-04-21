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
};
