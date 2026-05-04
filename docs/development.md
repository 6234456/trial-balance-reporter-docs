# Development Guide

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm generate:fixtures
```

## Runtime Boundary

Allowed:

- Vite dev server
- Node scripts for fixture generation
- GitHub Actions for build/deploy

Not allowed:

- Express / Fastify / API server
- database
- authentication
- server-side file upload
- remote Excel processing
