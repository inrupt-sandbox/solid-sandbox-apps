# Solid Pod Ecosystem

Three interconnected apps for browsing, sharing, and discovering data across [Solid Pods](https://solidproject.org/) on [Inrupt Pod Spaces](https://start.inrupt.com/) (ESS).

Built as a **reference implementation** demonstrating authentication, pod traversal, public indexing, access grants, and AI-powered data exploration with the Inrupt SDK.

## Architecture

```
                        ┌───────────────────────────────────────────┐
                        │        Inrupt Pod Spaces (ESS)            │
                        │         login.inrupt.com                  │
                        │                                           │
                        │  ┌─────────────┐    ┌──────────────────┐  │
                        │  │  WebID      │    │  Solid Pod       │  │
                        │  │  Profile    │    │  (storage.       │  │
                        │  │  (id.       │    │   inrupt.com)    │  │
                        │  │   inrupt.   │    │                  │  │
                        │  │   com)      │    │  • Resources     │  │
                        │  │             │    │  • Containers    │  │
                        │  └─────────────┘    │  • public-       │  │
                        │                     │    index.ttl     │  │
                        │  ┌──────────────┐   │  • Access rules  │  │
                        │  │ VC Service   │   └──────────────────┘  │
                        │  │ (vc.inrupt.  │                         │
                        │  │  com)        │                         │
                        │  │ • Grants     │                         │
                        │  │ • Requests   │                         │
                        │  └──────────────┘                         │
                        └──────────▲────────────────────────────────┘
                                   │  OIDC + Solid Protocol
                     ┌─────────────┴──────────────┐
                     │                             │
                     │                             │
┌─────────────────────────┐    ┌─────────────────────────────────────────┐
│   Pod Manager           │    │   Data Requester                        │
│   (Vite :5173)          │    │   Express :5174 → Vite :5175            │
│                         │    │                                         │
│  Browser-only SPA       │    │  Server-side auth + frontend SPA        │
│  • OIDC login (browser) │    │  • OIDC via solid-client-authn-node     │
│  • Spider pod contents  │    │  • Access grant queries via VC service  │
│  • Publish public index │    │  • Fetch resources using grant VCs      │
│  • Approve/deny grants  │    │  • Claude AI chatbot (server-side key)  │
└────────┬────────────────┘    └────────┬────────────────────────────────┘
         │                              │
         │  POST /register              │  GET /search, /directory
         │  POST /refresh-index         │  GET /lookup
         ▼                              ▼
┌─────────────────────────────────────────────────┐
│   Discovery Server (Express :3001)              │
│   • WebID registration + public index caching   │
│   • Substring search across users & resources   │
│   • In-memory store with JSON file persistence  │
└─────────────────────────────────────────────────┘
```

### Workspaces

| Workspace | Description |
|-----------|-------------|
| `packages/shared` | Types, RDF vocabulary, Turtle index builder/parser, discovery API client, shared utilities. Imported as `@solid-ecosystem/shared`. Exports raw `.ts` (no build step). |
| `apps/pod-manager` | Vite + vanilla TS browser SPA. Authenticates via `solid-client-authn-browser`, spiders the user's pod, builds/publishes a `public-index.ttl`, registers with discovery, manages access requests and grants. |
| `apps/data-requester` | Express server + Vite frontend. Server handles OIDC auth (`solid-client-authn-node`), access grant queries, resource fetching with grant VCs, and Claude AI chat. Frontend is a thin API client. |
| `apps/discovery-server` | Express REST API for WebID registration and search. Fetches and caches public indices. |

## Prerequisites

You need a Solid Pod on Inrupt Pod Spaces. Go to [start.inrupt.com](https://start.inrupt.com/), sign up, and create a pod. This gives you a WebID (e.g. `https://id.inrupt.com/yourname`) and a pod URL (e.g. `https://storage.inrupt.com/{uuid}/`).

You'll log in with these credentials when using the Pod Manager and Data Requester apps.

### Client Credentials (for server-side auth)

The Data Requester's Express server uses client credentials for server-side OIDC. To generate them:

1. Go to [login.inrupt.com](https://login.inrupt.com)
2. Log in with your Pod Spaces account
3. Navigate to **Application Registration** (or visit `https://login.inrupt.com/registration.html` directly)
4. Fill in your app name
5. Click **Register** — you'll receive a **Client ID** and **Client Secret**
6. Copy these into your `.env` file as `SOLID_CLIENT_ID` and `SOLID_CLIENT_SECRET`

These credentials are also needed if you run any of the utility scripts (e.g. `scripts/upload-client-id.ts`).

## Getting Started

```bash
# Install all dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your SOLID_CLIENT_ID, SOLID_CLIENT_SECRET, ANTHROPIC_API_KEY

# Run all apps concurrently
npm run dev

# Or run individually
cd apps/discovery-server && npm run dev   # http://localhost:3001
cd apps/pod-manager && npm run dev        # http://localhost:5173
cd apps/data-requester && npm run dev     # http://localhost:5174
```

## Test Flow

1. **User A** opens Pod Manager (:5173), logs in — pod is spidered automatically
2. User A clicks **Publish Index** → writes `public-index.ttl` to pod root with public read access
3. User A clicks **Register with Discovery** → appears in the directory
4. **User B** opens Data Requester (:5174), logs in, searches the discovery server
5. User B finds User A, browses their public resource index
6. User B selects resources and sends an access request (with modes and optional purpose)
7. User A sees the request in Pod Manager → approves or denies
8. User B's grants panel shows the approved grant → can browse granted resources
9. User B loads granted resources into the AI chatbot for intelligent exploration

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Bearer tokens only** | DPoP breaks access grants on ESS. `tokenType: "Bearer"` everywhere. |
| **Pod URL via `getPodUrlAll()`** | Never derived from WebID — they use different domains on Pod Spaces. |
| **Concurrency-limited spider** | Max 5 parallel fetches, 403s skipped gracefully. |
| **Public index as Turtle** | `public-index.ttl` at pod root enables PATCH updates without full rewrites. |
| **Access grants v4 API** | Uses `query()`/`paginatedQuery()` with getter helpers. |
| **`inherit: true` for containers** | Automatically set when requesting access to containers so the grant cascades to contents. |
| **Server-side auth for data-requester** | Keeps API keys and refresh tokens off the client. Express on :5174 proxies to Vite on :5175. |
| **Shared `escapeHtml` utility** | Single consistent implementation in `packages/shared` used across all HTML rendering. |
| **`VC_QUERY_ENDPOINT` in shared** | Inrupt VC query URL defined once in `packages/shared/src/vocab.ts`. |

## Project Structure

```
├── packages/shared/src/
│   ├── types.ts              # PodResource, PodIndex, DirectoryEntry
│   ├── vocab.ts              # RDF vocabulary constants + VC_QUERY_ENDPOINT
│   ├── pod-index.ts          # Turtle index builder/parser (SolidDataset ↔ PodIndex)
│   ├── discovery-client.ts   # Typed HTTP client for discovery server
│   └── utils.ts              # escapeHtml, formatModes
├── apps/pod-manager/src/
│   ├── auth.ts               # Browser OIDC (solid-client-authn-browser)
│   ├── pod-spider.ts         # Sliding-window concurrent pod traversal
│   ├── index-builder.ts      # PodResource[] → PodIndex
│   ├── index-writer.ts       # Write/PATCH public-index.ttl with ETag handling
│   ├── access-grants.ts      # Query/approve/deny/revoke access grants (v4)
│   ├── uploader.ts           # File upload + move
│   └── ui/                   # 7 UI modules (auth, status, tree, data-viewer, upload, access, grants)
├── apps/data-requester/
│   ├── server/
│   │   ├── auth.ts           # Server-side OIDC session management
│   │   └── routes.ts         # /api/grants, /api/fetch-resource, /api/chat, /api/request-access
│   └── src/
│       ├── auth.ts           # Frontend auth (calls /auth/status)
│       ├── access-requester.ts   # Calls /api/request-access
│       ├── grant-viewer.ts   # Calls /api/grants, /api/fetch-resource
│       ├── index-fetcher.ts  # Calls /api/pod-index with discovery fallback
│       ├── chatbot.ts        # Client-side conversation state + /api/chat calls
│       └── ui/               # 6 UI modules (auth, search, resource, request, grants, chat)
└── apps/discovery-server/src/
    ├── index.ts              # Express app + CORS config
    ├── routes.ts             # REST endpoints + HTML directory page
    ├── store.ts              # In-memory store with JSON file persistence
    └── index-fetcher.ts      # Fetches/parses public-index.ttl from pods
```

## Dependencies

| Package | Used By | Purpose |
|---------|---------|---------|
| `@inrupt/solid-client` | Pod Manager, Data Requester, Discovery Server | Pod data operations |
| `@inrupt/solid-client-authn-browser` | Pod Manager | Browser OIDC |
| `@inrupt/solid-client-authn-node` | Data Requester (server) | Server-side OIDC with token refresh |
| `@inrupt/solid-client-access-grants` v4 | Pod Manager, Data Requester (server) | Access request/grant lifecycle |
| `@anthropic-ai/sdk` | Data Requester (server) | Claude AI chatbot |
| `express`, `cors` | Discovery Server, Data Requester (server) | HTTP server |
| `vite`, `typescript` | Pod Manager, Data Requester | Build tooling |
| `tsx` | Discovery Server, Data Requester (server) | TypeScript execution (dev) |

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Used By |
|----------|----------|---------|
| `VITE_SOLID_CLIENT_ID` | Yes (browser apps) | OIDC client registration |
| `SOLID_CLIENT_ID` | Yes (server auth) | Server-side OIDC |
| `SOLID_CLIENT_SECRET` | Yes (server auth) | Server-side OIDC |
| `ANTHROPIC_API_KEY` | For chatbot | Claude AI integration |
| `SESSION_SECRET` | Recommended | Cookie session encryption |
