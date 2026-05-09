# FYM Cotizador

Sistema modular de cotizaciones, costos, proyectos, caja chica y RRHH.

## Stack

- Frontend: Next.js + Tailwind (`packages/frontend`)
- Backend: NestJS (`packages/backend`)
- Base de datos y archivos: Firebase (Firestore + Storage)
- Deploy:
  - Frontend: Firebase Hosting
  - Backend: Railway (Dockerfile en `packages/backend/Dockerfile`)

## Requisitos

- Node 20+
- pnpm 10+
- Firebase CLI (`pnpm dlx firebase --version` o `pnpm firebase --version`)

## Variables de entorno

Usa `.env.example` como base:

```bash
cp .env.example .env
```

Variables clave:

- Backend:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `BACKEND_PORT`
  - `FRONTEND_URL`
- Frontend:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_FIREBASE_*`

## Desarrollo local

```bash
pnpm install
pnpm dev
```

## Build local

```bash
pnpm build
```

También puedes ejecutar por capa:

```bash
pnpm build:backend
pnpm build:frontend
```

## Despliegue

**URLs de producción (proyecto Firebase `cotiza-luis`):**

- Sitio estático (Hosting): https://cotiza-luis.web.app  
- API en Cloud Functions (misma cuenta Firebase): el cliente debe usar `NEXT_PUBLIC_API_URL` apuntando a la URL pública del hosting con `/api/v1` (por ejemplo `https://cotiza-luis.web.app/api/v1`), o bien el backend en **Railway** si así lo tienes configurado en el build.

### 1) Frontend y reglas (Firebase Hosting + Firestore + Storage)

Build + deploy de hosting y reglas (sin Functions):

```bash
pnpm deploy:frontend
```

Deploy completo: frontend exportado + Cloud Function `api` + reglas Firestore e índices + Storage:

```bash
pnpm deploy:firebase
```

Solo actualizar la función `api` tras cambios en el backend:

```bash
pnpm deploy:functions
```

### 2) Backend (Railway)

El repositorio incluye `railway.json` para usar `packages/backend/Dockerfile`.

Configura en Railway:

- Variables del backend (mismas de `.env.example`)
- Puerto de escucha (`PORT`) administrado por Railway
- Proyecto conectado a este repo y rama (`master`)

### Nota sobre `vercel.json`

El despliegue **canónico** del frontend es **Firebase Hosting**.
Existen dos `vercel.json` (raíz del repo y `packages/frontend/`) sólo
para soportar previews de Vercel cuando el "Root Directory" del proyecto
en Vercel sea `/` o `packages/frontend` respectivamente. **No agregues
lógica de negocio nueva en estos archivos**; mantén ambos sincronizados
o elimínalos si dejas de usar Vercel.

## CI/CD en GitHub Actions

Workflows incluidos:

- `.github/workflows/ci.yml`:
  - Instala dependencias
  - Compila shared + backend + frontend en PR y pushes
- `.github/workflows/deploy-frontend-firebase.yml`:
  - Despliega frontend a Firebase al hacer push a `master`

Secrets requeridos para deploy frontend:

- `FIREBASE_TOKEN`
- `FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Estado de despliegue (checklist)

- [x] Build frontend OK
- [x] Build backend OK
- [x] Config Firebase Hosting en `firebase.json`
- [x] Config Railway en `railway.json`
- [x] CI de validación
- [x] CD de frontend a Firebase
