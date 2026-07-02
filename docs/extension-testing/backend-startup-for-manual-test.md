# Backend Startup For Manual Test

Date: 2026-07-01

Use these steps from Windows PowerShell.

## 1. Open The Project

```powershell
cd C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard
```

## 2. Prepare Environment Variables

Check that `.env` exists. The repository also has `.env.example` with the required local values:

```powershell
Get-Content .env.example
```

Minimum local values needed for manual testing:

```text
DATABASE_URL="postgresql://user:password@localhost:5432/soter"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

Do not put real production secrets in local manual test files.

## 3. Start Postgres

The checked-in `docker-compose.yml` is production-oriented and does not define a Postgres service. For a local manual test, use an already installed Postgres instance, or start a disposable Docker Postgres container:

```powershell
docker run --name soter-postgres-manual -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=soter -p 5432:5432 -d postgres:16-alpine
```

If the container already exists:

```powershell
docker start soter-postgres-manual
```

Verify Postgres is listening:

```powershell
docker ps --filter "name=soter-postgres-manual"
```

If Docker is not installed, install Docker Desktop or create a local PostgreSQL database named `soter`, then set `DATABASE_URL` to match your local username, password, host, and port.

## 4. Start Redis And Qdrant If Needed

The repository `docker-compose.yml` defines Redis and Qdrant, but also defines an `app` service image for production. For local Next.js development, start only the dependencies:

```powershell
docker compose up -d redis qdrant
```

If Docker Compose complains about a missing production image for `app`, make sure you did not run `docker compose up -d` without service names.

## 5. Apply Prisma Migrations

The actual repository script is `db:deploy`:

```powershell
npm run db:deploy
```

If you are actively developing schema changes and want Prisma dev behavior instead:

```powershell
npm run db:migrate
```

For final manual extension validation, prefer `npm run db:deploy`.

## 6. Seed Demo Admin/Test Organization

The actual repository script is:

```powershell
npm run db:seed
```

Expected seed output includes:

```text
Seed complete.
Demo user: demo@cyberrakshak.dev / demo-cyberrakshak-2026
Demo organization: demo-cyberrakshak
```

Use only this synthetic demo user for manual testing.

## 7. Start Next.js Backend/Admin Dashboard

```powershell
npm run dev
```

Expected local URL:

```text
http://localhost:3000
```

Verify backend is running:

```powershell
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

Open the dashboard:

```text
http://localhost:3000/signin
```

Sign in with:

```text
Email: demo@cyberrakshak.dev
Password: demo-cyberrakshak-2026
```

## 8. Create Or Find An Enrollment Token

Open:

```text
http://localhost:3000/admin/extension-enrollments
```

Create an enrollment token for the demo organization. Copy the raw token immediately; tokens are designed to be shown only once.

If the UI cannot create a token during testing, check the API route exists:

```text
POST /api/admin/extension-enrollment-token
```

Use the UI first so the browser session handles admin authentication.

## 9. If Port 3000 Is Busy

Find the process:

```powershell
netstat -ano | findstr :3000
```

Either stop that process, or start Next.js on another port:

```powershell
$env:PORT=3001
npm run dev
```

If you use port 3001, enroll the extension with:

```text
http://localhost:3001
```

## 10. Stop Local Services

Stop Next.js with `Ctrl+C`.

Stop Docker dependencies:

```powershell
docker compose stop redis qdrant
docker stop soter-postgres-manual
```
