# Contributing to Soter

Thank you for your interest in contributing to Soter! This guide will help you get started.

## Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.9+ and pip
- **PostgreSQL** 14+ (for the Next.js app)
- **Docker** (optional, for production testing)

## Project Structure

```
├── app/                          # Next.js app (main application)
├── packages/
│   ├── sdk/                      # @soterai/core (TypeScript SDK)
│   ├── python-sdk/               # soter (Python SDK)
│   ├── langchain-middleware/     # @soterai/langchain-middleware
│   ├── llamaindex-middleware/    # @soterai/llamaindex-middleware
│   └── vercel-ai-sdk-middleware/ # @soterai/vercel-ai-sdk-middleware
├── examples/                     # Integration demos
├── docs/                         # Documentation
├── tests/                        # App test suite
└── lib/                          # Core backend logic
```

## Development Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/soter.git
cd soter

# Install app dependencies
npm install

# Install SDK dependencies
cd packages/sdk && npm install && cd ../..
cd packages/langchain-middleware && npm install && cd ../..
cd packages/llamaindex-middleware && npm install && cd ../..
cd packages/vercel-ai-sdk-middleware && npm install && cd ../..
```

### 2. Environment setup

```bash
cp .env.example .env
# Edit .env with your PostgreSQL URL and secrets
```

### 3. Database setup

```bash
npm run db:deploy
npm run db:seed
```

### 4. Start development server

```bash
npm run dev
# → http://localhost:3000
```

## Making Changes

### Code style

- TypeScript: ESLint + Prettier (configs in root)
- Python: Follow PEP 8
- Commits: Use conventional commit format (`feat:`, `fix:`, `chore:`, `docs:`, etc.)

### Before committing

Pre-commit hooks will run automatically:

```bash
# Manual check
npm run typecheck
npm test
npm run lint
```

### Testing

```bash
# App tests
npm test

# TypeScript SDK tests
cd packages/sdk && npm test

# Python SDK tests
cd packages/python-sdk && python -m pytest tests/ -q

# Middleware typechecks
cd packages/langchain-middleware && npm run typecheck
cd packages/llamaindex-middleware && npm run typecheck
cd packages/vercel-ai-sdk-middleware && npm run typecheck

# E2E tests
npm run test:e2e
```

## Publishing

Only maintainers can publish packages. The CI/CD pipeline handles publishing:

1. Push a tag: `git tag v0.2.0 && git push origin v0.2.0`
2. CI builds and tests everything
3. On success, publishes:
   - npm: `@soterai/core`, `@soterai/langchain-middleware`, `@soterai/llamaindex-middleware`, `@soterai/vercel-ai-sdk-middleware`
   - PyPI: `soter`

### Manual publishing

```bash
# npm packages
cd packages/sdk && npm publish
cd packages/langchain-middleware && npm publish

# Python SDK
cd packages/python-sdk
python -m build
twine upload dist/*
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Ensure all tests pass
4. Update documentation if needed
5. Open a PR with a clear description

## License

MIT
