# Real Chatbot Test App

This is a minimal Express + TypeScript chatbot application to verify the `@soter/core` SDK integration, LLM response handling, and plan billing limits (Free and Pro plans).

## Setup

1. Build the parent SDK project:
   ```bash
   npm run build --prefix packages/sdk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy and configure the environment variables:
   ```bash
   cp .env.example .env
   ```

## Running the Chatbot

Start the Express API server on port `4000`:
```bash
npm start
```

## Running Automated Tests

To run the automated chatbot testing suite, load test, and billing verification:
```bash
npm run test:real
```
