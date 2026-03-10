# Solid Pod Ecosystem

Three interconnected applications for browsing, sharing, and discovering data across [Solid Pods](https://solidproject.org/) on [Inrupt Pod Spaces](https://start.inrupt.com/) (ESS).

## Apps

### Pod Manager (`apps/pod-manager` — localhost:5173)
Manage your pod's data and control access.
- Login via Inrupt OIDC (Bearer tokens)
- Recursively spider your pod contents (concurrency-limited, skips 403s)
- Browse resources in a tree view
- Publish a public index (`public-index.ttl`) with public read access
- Register with the discovery server
- View, approve, and deny incoming access requests

### Data Requester (`apps/data-requester` — localhost:5174)
Discover other users and request access to their data.
- Login via Inrupt OIDC (Bearer tokens)
- Search the discovery server or enter a WebID directly
- Browse a user's public resource index
- Select resources and send access requests with configurable modes and purpose

### Discovery Server (`apps/discovery-server` — localhost:3001)
A lightweight Express server for WebID registration and search.
- `POST /register` — register a WebID (fetches and caches their public index)
- `GET /directory` — list all registered users
- `GET /search?q=term` — substring search across WebIDs, names, and resource URLs
- HTML directory page at `/`
- In-memory store with JSON file persistence

## Shared Package

`packages/shared` contains types, RDF vocabulary constants, a Turtle index builder/parser, and a typed client for the discovery server API.

## Getting Started

```bash
# Install all dependencies
npm install

# Start all three apps (in separate terminals)
cd apps/discovery-server && npm run dev   # http://localhost:3001
cd apps/pod-manager && npm run dev        # http://localhost:5173
cd apps/data-requester && npm run dev     # http://localhost:5174
```

## Test Flow

1. **User A** opens Pod Manager, logs in, pod is spidered automatically
2. User A clicks **Publish Index** to write `public-index.ttl` to their pod
3. User A clicks **Register with Discovery** to appear in the directory
4. **User B** opens Data Requester, logs in, searches the discovery server
5. User B finds User A, browses their public resource index
6. User B selects resources and sends an access request
7. User A sees the request in Pod Manager and approves or denies it

## Key Technical Decisions

- **Bearer tokens only** — DPoP breaks access grants on ESS
- **Pod URL via `getPodUrlAll()`** — never derived from WebID
- **Concurrency-limited spider** — max 5 parallel fetches, 403s skipped gracefully
- **Public index as Turtle** — enables PATCH updates without full rewrites
- **Vanilla TS + Vite** — no framework overhead, direct DOM manipulation
- **Access grants v4** — uses `query()`/`paginatedQuery()` API with getter helpers

## Dependencies

| Package | Used By |
|---------|---------|
| `@inrupt/solid-client` | Pod Manager, Data Requester |
| `@inrupt/solid-client-authn-browser` | Pod Manager, Data Requester |
| `@inrupt/solid-client-access-grants` v4 | Pod Manager, Data Requester |
| `express`, `cors` | Discovery Server |
| `vite`, `typescript` | Pod Manager, Data Requester |
| `tsx` | Discovery Server (dev) |
