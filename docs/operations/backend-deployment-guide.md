# Soter Enterprise AI Control Plane - Deployment Guide

This document outlines how to deploy the Soter enterprise backend to cloud providers like Vercel, Render, Fly.io, or AWS.

## Prerequisites
- A PostgreSQL database (e.g., Neon, Supabase, RDS)
- A Redis instance (e.g., Upstash, ElastiCache)
- Node.js environment

## Option 1: Vercel (Recommended for Next.js)
1. Push your repository to GitHub.
2. Import the project in Vercel.
3. Configure the Build Command as `npm run build`.
4. Add the environment variables from `.env.production.example`.
5. Run `npx prisma migrate deploy` in the build steps or manually via CLI.
6. Deploy.

## Option 2: Render / Fly.io (Docker Container)
1. Use the included `Dockerfile` and `docker-compose.prod.yml`.
2. Connect your repository to Render or run `fly launch`.
3. Provide the environment variables.
4. Ensure the database connection supports connection pooling (PgBouncer) if scaling horizontally.

## Option 3: AWS ECS / Fargate
1. Build the Docker image and push to ECR.
2. Create an ECS Task Definition with the container image.
3. Pass environment variables via AWS Secrets Manager.
4. Set up an Application Load Balancer to route traffic to the ECS service on port 3000.

## Worker Nodes
If you plan to handle high volumes of SIEM logs or Background tasks, consider running the `worker:webhooks` and `worker:siem` scripts in isolated containers for better performance.
