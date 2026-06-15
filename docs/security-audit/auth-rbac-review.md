# Auth and RBAC Review

Authentication uses NextAuth credentials with bcrypt password hashing and JWT sessions. Private routes must call server-side guard helpers. Roles map to explicit permissions; UI hiding is not authorization.

Review focus:

- Session freshness.
- Organization membership checks.
- Project permission checks.
- Admin-only pages and APIs.
- Worker token routes.

