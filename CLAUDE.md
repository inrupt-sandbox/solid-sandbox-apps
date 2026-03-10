# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

npm workspaces monorepo with three apps that enable browsing, sharing, and discovering data across Solid Pods on Inrupt Pod Spaces (ESS). Includes an AI chatbot for exploring granted data via Claude.

## Commands

```bash
# Install all workspace dependencies from root
npm install

# Run all apps concurrently (discovery :3001, pod-manager :5173, data-requester :5174)
npm run dev

# Or run individually
cd apps/discovery-server && npm run dev   # Express server on :3001 (tsx watch)
cd apps/pod-manager && npm run dev        # Vite on :5173
cd apps/data-requester && npm run dev     # Express :5174 + Vite :5175 (concurrently)

# Build browser apps
cd apps/pod-manager && npm run build      # tsc && vite build
cd apps/data-requester && npm run build   # tsc && vite build
```

No test runner or linter is configured.

## Architecture

### Workspaces
- **`packages/shared`** — Types (`PodResource`, `PodIndex`, `DirectoryEntry`), RDF vocabulary constants, `VC_QUERY_ENDPOINT`, Turtle index builder/parser, discovery API client, shared utilities (`escapeHtml`, `formatModes`). Imported as `@solid-ecosystem/shared`. Exports raw `.ts` source (no build step).
- **`apps/pod-manager`** — Vite + vanilla TS browser SPA. Authenticates via `solid-client-authn-browser` OIDC, spiders user's pod, builds/publishes a public Turtle index, registers with discovery server, manages incoming access requests and active grants.
- **`apps/data-requester`** — Express server (`:5174`) + Vite frontend (`:5175`). Server handles OIDC auth (`solid-client-authn-node`), access grant queries, resource fetching via grant VCs, Claude AI chat. Frontend is a thin API client that proxies through the server.
- **`apps/discovery-server`** — Express server. REST API for WebID registration and search. In-memory store with JSON file persistence. Runs via `tsx watch`.

### Key Patterns
- **Bearer tokens only** — `tokenType: "Bearer"` in all auth calls; DPoP breaks access grants on ESS.
- **Pod URL via `getPodUrlAll()`** — never derived from WebID.
- **Concurrency-limited pod spider** — max 5 parallel fetches, 403s skipped.
- **Public index as Turtle** — `public-index.ttl` written to pod root, enables PATCH updates.
- **Access grants v4 API** — uses `query()`/`paginatedQuery()` with getter helpers from `@inrupt/solid-client-access-grants`.
- **`inherit: true` for containers** — automatically set when requesting access to container URLs so the grant cascades to contents.
- **Shared utilities** — `escapeHtml` and `formatModes` in `packages/shared/src/utils.ts`; `VC_QUERY_ENDPOINT` in `packages/shared/src/vocab.ts`. No local copies.
- **Server-side auth for data-requester** — Express on :5174 proxies to Vite on :5175 in dev. Frontend calls `/api/*` and `/auth/*` endpoints.
- **Vanilla TS + Vite** — no framework; direct DOM manipulation in `src/ui/` modules.
- **OIDC issuer** — hardcoded to `https://login.inrupt.com`.
- **Discovery server CORS** — allows origins `:5173` and `:5174`.

### TypeScript
Base config in `tsconfig.base.json`: strict mode, ES2020 target, ESNext modules, bundler resolution.
