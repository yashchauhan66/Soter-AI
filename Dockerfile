FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN useradd --create-home --uid 10001 cyberrakshak
COPY --from=builder --chown=cyberrakshak:cyberrakshak /app ./
USER cyberrakshak
EXPOSE 3000
CMD ["npm", "run", "start"]
