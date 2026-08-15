FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
# Phase 5A: ssh2 has an optional native addon (cpu-features) that needs a
# build toolchain on Alpine — without this, npm install still "succeeds"
# but silently skips the addon and ssh2 falls back to a pure-JS path, which
# is fine functionally but let's build it properly since the tools are cheap.
RUN apk add --no-cache python3 make g++ openssl
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm install --workspaces --include-workspace-root

FROM base AS build
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate -w apps/api
RUN npm run build -w apps/api

FROM base AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
