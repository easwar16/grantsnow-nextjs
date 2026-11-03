# Stage 1: Install dependencies
FROM node:26-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build Next.js
FROM node:26-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Selects which .env.<env> is baked in as .env.production; falls back to .env.
ARG GRANTSNOW_ENV
ENV GRANTSNOW_ENV=$GRANTSNOW_ENV
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Runtime
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./

# The build-time selector is not a runtime setting; .env.production carries the environment.
RUN rm -f .env

USER node

EXPOSE 3000

CMD ["node", "server.js"]
