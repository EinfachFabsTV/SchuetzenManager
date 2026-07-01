# Single-container deployment for central hosting: builds the React
# frontend as static assets and the Fastify backend, then serves both from
# one Node process (see src/server.ts's @fastify/static registration).
# Build context is this Rework/ directory: `docker build -f Dockerfile .`

FROM node:20-slim AS frontend-build
WORKDIR /app/apps/frontend
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm ci
COPY apps/frontend ./
RUN npm run build

FROM node:20-slim AS backend-build
WORKDIR /app/apps/backend
COPY apps/backend/package.json apps/backend/package-lock.json* ./
RUN npm ci
COPY apps/backend ./
RUN npm run prisma:generate:postgresql
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-build /app/apps/backend/package.json ./package.json
COPY --from=backend-build /app/apps/backend/node_modules ./node_modules
COPY --from=backend-build /app/apps/backend/dist ./dist
COPY --from=backend-build /app/apps/backend/prisma-postgresql ./prisma-postgresql
COPY --from=frontend-build /app/apps/frontend/dist ./dist/public

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma-postgresql/schema.prisma && node dist/server.js"]
