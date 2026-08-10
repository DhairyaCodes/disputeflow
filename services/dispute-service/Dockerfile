FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/dispute-service/package.json services/dispute-service/package.json
COPY services/evidence-service/package.json services/evidence-service/package.json
COPY analytics/package.json analytics/package.json
RUN npm ci --omit=dev --workspace services/dispute-service

FROM node:22-alpine
ENV NODE_ENV=production
USER node
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node services/dispute-service ./services/dispute-service
WORKDIR /app/services/dispute-service
EXPOSE 3001
CMD ["node", "src/server.js"]
