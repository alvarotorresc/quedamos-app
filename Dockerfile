# ============================================================
# quedamos-api — Multi-stage Dockerfile
# Context: monorepo root (quedamos-app/)
# ============================================================

# ---------- Stage 1: Build ----------
FROM node:22-slim AS build

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Use hoisted node_modules (flat, like npm) so symlinks don't break between layers
RUN echo "node-linker=hoisted" > .npmrc

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY apps/api apps/api

# The API imports @quedamos/shared from its dist, so the workspace package is
# compiled before nest resolves it.
RUN pnpm --filter @quedamos/shared build

WORKDIR /app/apps/api
RUN npx prisma generate && npx nest build

# ---------- Stage 2: Production ----------
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

RUN echo "node-linker=hoisted" > .npmrc

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma

WORKDIR /app/apps/api
RUN sed -i '/generator dbml/,/^}/d' prisma/schema.prisma && npx prisma generate

USER node

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
