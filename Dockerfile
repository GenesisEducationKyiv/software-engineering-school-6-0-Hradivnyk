# Stage 1 build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY services/notification/package.json ./services/notification/
COPY .husky/install.mjs ./.husky/install.mjs
RUN npm ci

COPY tsconfig.json ./
COPY knexfile.ts ./
COPY src ./src

RUN npm run build

# Stage 2 production image
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY services/notification/package.json ./services/notification/
COPY .husky/install.mjs ./.husky/install.mjs
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY swagger.yaml ./
COPY knexfile.ts ./
COPY public ./public
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["sh", "docker-entrypoint.sh"]
