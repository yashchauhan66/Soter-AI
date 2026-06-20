ARG NEXTAUTH_SECRET
ARG AUTH_SECRET

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts

FROM dependencies AS builder
ARG NEXTAUTH_SECRET
ARG AUTH_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV AUTH_SECRET=$AUTH_SECRET
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 cyberrakshak
COPY --from=builder --chown=cyberrakshak:cyberrakshak /app ./
USER cyberrakshak
EXPOSE 3000
CMD ["npm", "run", "start"]
