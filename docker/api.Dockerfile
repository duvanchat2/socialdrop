FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate --schema=libs/prisma/prisma/schema.prisma
RUN npx nx build api --configuration=production

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/apps/api ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs/prisma/prisma ./prisma
EXPOSE 3000
CMD ["node", "main.js"]
