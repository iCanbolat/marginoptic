# Faz 9 — Churnify API üretim image'ı (NestJS, pnpm monorepo).
# Çok aşamalı: build → pnpm deploy (prod-only, self-contained) → ince runtime.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Tüm monorepo (workspace çözümü için); .dockerignore gereksizleri eler.
COPY . .
RUN pnpm install --frozen-lockfile
# Shared önce derlenir (api ona bağımlı), sonra api.
RUN pnpm --filter @churnify/shared build \
  && pnpm --filter @churnify/api build
# Prod-only, self-contained çıktı (/app): dist + src (migrations) + prod node_modules.
RUN pnpm --filter @churnify/api deploy --prod /app

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# Düşük ayrıcalıklı kullanıcı
USER node
EXPOSE 3000
# Migration'lar üretimde ayrı adım/servis olarak: `node dist/database/migrate.js`.
CMD ["node", "dist/main"]
