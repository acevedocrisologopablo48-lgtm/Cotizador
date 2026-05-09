FROM node:24-alpine AS base
RUN npm install -g pnpm@9.15.9

# ── deps stage ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/fym-shared-1.0.0.tgz ./packages/backend/
RUN pnpm install --frozen-lockfile
# Ensure exceljs is linked (pnpm CAS hard-link can fail silently on some hosts)
RUN test -d packages/backend/node_modules/exceljs || (cd packages/backend && npm install exceljs@4.4.0 --no-save --legacy-peer-deps --quiet)

# ── build stage ─────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY . .
# Build shared first, then backend
RUN pnpm --filter shared build || true
RUN pnpm --filter backend build

# ── production stage ─────────────────────────────────────────
FROM node:24-alpine AS production
RUN npm install -g pnpm@9.15.9
RUN apk add --no-cache \
  ca-certificates \
  chromium \
  freetype \
  harfbuzz \
  nss \
  ttf-freefont
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/fym-shared-1.0.0.tgz ./packages/backend/
RUN pnpm install --frozen-lockfile --prod
# Ensure exceljs is linked (pnpm CAS hard-link can fail silently on some hosts)
RUN test -d packages/backend/node_modules/exceljs || (cd packages/backend && npm install exceljs@4.4.0 --no-save --legacy-peer-deps --quiet)

COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/packages/backend

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 8080

CMD ["node", "dist/main"]
