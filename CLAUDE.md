# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

npm workspaces monorepo with three apps that enable browsing, sharing, and discovering data across Solid Pods on Inrupt Pod Spaces (ESS).

## Commands

```bash
# Install all workspace dependencies from root
npm install

# Run all three apps concurrently (discovery :3001, pod-manager :5173, data-requester :5174)
npm run dev

# Or run individually
cd apps/discovery-server && npm run dev   # Express server on :3001 (tsx watch)
cd apps/pod-manager && npm run dev        # Vite on :5173
cd apps/data-requester && npm run dev     # Vite on :5174

# Build browser apps
cd apps/pod-manager && npm run build      # tsc && vite build
cd apps/data-requester && npm run build   # tsc && vite build
```

No test runner or linter is configured.

## Architecture

### Workspaces
- **`packages/shared`** — Shared types (`PodResource`, `PodIndex`, `DirectoryEntry`), RDF vocabulary constants, Turtle index builder/parser, discovery server API client. Imported as `@solid-ecosystem/shared`. Exports raw `.ts` source (no build step).
- **`apps/pod-manager`** — Vite + vanilla TS browser app. Authenticates via Inrupt OIDC, spiders user's pod, builds/publishes a public Turtle index, registers with discovery server, manages incoming access grant requests.
- **`apps/data-requester`** — Vite + vanilla TS browser app. Authenticates via Inrupt OIDC, searches discovery server for users, browses their public index, sends access requests.
- **`apps/discovery-server`** — Express server. REST API for WebID registration and search. In-memory store with JSON file persistence. Runs via `tsx watch`.

### Key Patterns
- **Bearer tokens only** — `tokenType: "Bearer"` in all auth calls; DPoP breaks access grants on ESS.
- **Pod URL via `getPodUrlAll()`** — never derived from WebID.
- **Concurrency-limited pod spider** — max 5 parallel fetches, 403s skipped.
- **Public index as Turtle** — `public-index.ttl` written to pod root, enables PATCH updates.
- **Access grants v4 API** — uses `query()`/`paginatedQuery()` with getter helpers from `@inrupt/solid-client-access-grants`.
- **Vanilla TS + Vite** — no framework; direct DOM manipulation in `src/ui/` modules.
- **OIDC issuer** — hardcoded to `https://login.inrupt.com` in both browser apps' `auth.ts`.
- **Discovery server CORS** — only allows origins `:5173` and `:5174`.

### TypeScript
Base config in `tsconfig.base.json`: strict mode, ES2020 target, ESNext modules, bundler resolution.
