---
name: build-solid-app
description: >
  Build applications using Solid Pods (Pod Spaces as default provider). Covers
  authentication (OIDC with Bearer tokens), pod discovery, reading/writing data,
  containers, access grants, notifications, and all the common gotchas. Use this
  skill when the user wants to build a Solid app, integrate with Solid Pods, or
  work with Inrupt libraries.
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Bash(node:*), Bash(curl:*)
---

# Build a Solid App (Pod Spaces)

This skill helps you build apps that use Solid Pods for decentralized data storage. It targets **Inrupt Pod Spaces** (ESS - Enterprise Solid Server) with login at `https://login.inrupt.com`.

## Key references

- **Browser auth:** https://inrupt.github.io/solid-client-authn-js/browser/
- **Node.js auth:** https://inrupt.github.io/solid-client-authn-js/node/
- **Pod data operations:** https://inrupt.github.io/solid-client-js/
- **Pod discovery (getPodUrlAll):** https://inrupt.github.io/solid-client-js/functions/profile_webid.getPodUrlAll.html
- **Binary file writes (overwriteFile):** https://inrupt.github.io/solid-client-js/functions/resource_file.overwriteFile.html
- **Access grants:** https://inrupt.github.io/solid-client-access-grants-js/
- **Token refresh (Node):** https://inrupt.github.io/solid-client-authn-js/node/functions/refreshTokens.html

## Quick start scaffold

When creating a new Solid app, install these core packages:

```bash
npm install @inrupt/solid-client @inrupt/solid-client-authn-node  # backend
npm install @inrupt/solid-client @inrupt/solid-client-authn-browser  # frontend (browser)
```

Optional but common:

```bash
npm install @inrupt/solid-client-access-grants   # access grants (delegated access)
npm install @inrupt/solid-client-notifications    # WebSocket pod change notifications
npm install jose                                  # JWT/JWK handling (if working with tokens directly)
```

## Architecture decision: Backend vs Browser auth

| Approach | Package | Use when |
|----------|---------|----------|
| **Backend (recommended)** | `solid-client-authn-node` | You have a server, need token refresh, want to protect client secrets |
| **Browser** | `solid-client-authn-browser` | Pure SPA, no server, simpler but tokens visible to client |

Backend auth is strongly recommended for production apps. The browser library works for prototypes.

---

## 1. Authentication (OIDC)

### Backend login flow

```typescript
import { Session } from '@inrupt/solid-client-authn-node';

// IMPORTANT: Always use keepAlive: true to maintain the session
const session = new Session({ keepAlive: true });

// CRITICAL: Use Bearer tokens, NOT DPoP (see Gotcha #1)
// This is REQUIRED when using access grants
await session.login({
  oidcIssuer: 'https://login.inrupt.com',
  redirectUrl: `${YOUR_BACKEND_URL}/auth/callback`,
  tokenType: 'Bearer',
  // Client identification (pick one):
  clientId: process.env.SOLID_CLIENT_ID,       // registered client
  // OR for localhost dev:
  clientName: 'My App',                        // public client registration
});
```

### Callback handling

```typescript
// In your /auth/callback route:
await session.handleIncomingRedirect(`${YOUR_BACKEND_URL}/auth/callback?${queryString}`);

if (session.info.isLoggedIn) {
  const webId = session.info.webId;
  // session.fetch is now an authenticated fetch
  // Store session info (tokens, webId) in your session store
}
```

### Token refresh (YOU must implement this)

**CRITICAL: The Node.js auth library does NOT handle token refresh automatically.** You must implement refresh logic yourself. The browser library handles it, but `solid-client-authn-node` does not.

Use `refreshTokens()` from the SDK: https://inrupt.github.io/solid-client-authn-js/node/functions/refreshTokens.html

```typescript
import { refreshTokens } from '@inrupt/solid-client-authn-node';

// You must track token expiry and refresh proactively (e.g., in middleware)
// Check if token expires within the next 10 seconds
const tokenExpiresAt = /* stored from previous token response */;
if (Date.now() >= tokenExpiresAt - 10_000) {
  const newTokens = await refreshTokens(refreshToken, {
    tokenEndpoint,
    clientId,
  });
  // Store newTokens.accessToken, newTokens.refreshToken, newTokens.expiresIn
  // The refresh token rotates on each use - always store the NEW refresh token
}
```

**Important:** Refresh tokens rotate on each use. If you call `refreshTokens()` twice with the same refresh token, the second call will fail. See Gotcha #7 for deduplication pattern.

---

## 2. Pod discovery (the #1 gotcha)

**CRITICAL: You MUST use `getPodUrlAll()` to find the pod URL. Do NOT assume the pod URL from the WebID.**

A WebID like `https://id.inrupt.com/alice` does NOT mean the pod is at `https://id.inrupt.com/alice/`. The pod URL is declared in the WebID profile document via `pim:storage`.

```typescript
import { getPodUrlAll } from '@inrupt/solid-client';

// CORRECT: Discover pod URL from WebID profile
const podUrls = await getPodUrlAll(session.info.webId, { fetch: session.fetch });
const podUrl = podUrls[0]; // First pod is typically the default

// WRONG: Do NOT do this
// const podUrl = session.info.webId + '/';  // WRONG - WebID != Pod URL
```

On Pod Spaces, a typical mapping is:
- WebID: `https://id.inrupt.com/alice`
- Pod URL: `https://storage.inrupt.com/{uuid}/`

There is no way to derive one from the other. Always use `getPodUrlAll()`.

**Graceful fallback:**

```typescript
let podUrls: string[] = [];
try {
  podUrls = await getPodUrlAll(session.info.webId, { fetch: session.fetch });
} catch (error) {
  console.warn('Could not fetch Pod URLs:', error);
}
if (podUrls.length === 0) {
  // Handle: user may not have a pod provisioned yet
}
```

---

## 3. Reading and writing data

**Resources in a Solid Pod do NOT have to be RDF.** They can be any binary or text format (JSON, PDF, images, CSV, etc.). Use the appropriate content type.

### Read a file (any type)

```typescript
import { getFile } from '@inrupt/solid-client';

// Works for ANY file type - text, JSON, binary, images, PDFs, etc.
const file = await getFile(
  `${podUrl}documents/notes.txt`,
  { fetch: session.fetch }
);
const text = await file.text();       // for text files
// const buffer = await file.arrayBuffer();  // for binary files
```

### Write a file (any type)

Use `overwriteFile` for writing any resource. Ref: https://inrupt.github.io/solid-client-js/functions/resource_file.overwriteFile.html

```typescript
import { overwriteFile } from '@inrupt/solid-client';

// JSON file
const content = JSON.stringify({ name: 'Alice', age: 30 }, null, 2);
const blob = new Blob([content], { type: 'application/json' });
await overwriteFile(`${podUrl}documents/profile.json`, blob, {
  contentType: 'application/json', fetch: session.fetch,
});

// Binary file (e.g., PDF, image)
const pdfBuffer = fs.readFileSync('./report.pdf');
const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
await overwriteFile(`${podUrl}documents/report.pdf`, pdfBlob, {
  contentType: 'application/pdf', fetch: session.fetch,
});

// CSV
const csv = 'name,age\nAlice,30\nBob,25';
const csvBlob = new Blob([csv], { type: 'text/csv' });
await overwriteFile(`${podUrl}data/export.csv`, csvBlob, {
  contentType: 'text/csv', fetch: session.fetch,
});
```

### Write JSON-LD (structured linked data)

When you want structured, machine-readable data with semantic meaning:

```typescript
const document = {
  '@context': {
    '@vocab': 'https://schema.org/',
  },
  '@type': 'Person',
  name: 'Alice',
  email: 'alice@example.com',
};

const blob = new Blob(
  [JSON.stringify(document, null, 2)],
  { type: 'application/ld+json' }
);

await overwriteFile(
  `${podUrl}profile/me.jsonld`,
  blob,
  { contentType: 'application/ld+json', fetch: session.fetch }
);
```

### Delete a file

```typescript
import { deleteFile } from '@inrupt/solid-client';

await deleteFile(`${podUrl}documents/old-file.txt`, { fetch: session.fetch });
```

---

## 4. Working with containers (folders)

### List container contents

```typescript
import { getSolidDataset, getContainedResourceUrlAll } from '@inrupt/solid-client';

const dataset = await getSolidDataset(`${podUrl}documents/`, { fetch: session.fetch });
const resourceUrls = getContainedResourceUrlAll(dataset);
// Returns: ['https://storage.inrupt.com/{uuid}/documents/file1.txt', ...]
```

### Create a container

```typescript
import { createContainerAt } from '@inrupt/solid-client';

await createContainerAt(`${podUrl}my-app/data/`, { fetch: session.fetch });
```

### Ensure a container exists (idempotent pattern)

**CRITICAL: Always ensure containers exist before writing files. Writing to a non-existent container fails.**

```typescript
import { getSolidDataset, createContainerAt } from '@inrupt/solid-client';

async function ensureContainerExists(
  containerUrl: string,
  fetch: typeof globalThis.fetch
): Promise<void> {
  try {
    await getSolidDataset(containerUrl, { fetch });
  } catch {
    await createContainerAt(containerUrl, { fetch });
  }
}

// Usage: always call before writing
await ensureContainerExists(`${podUrl}my-app/`, session.fetch);
await ensureContainerExists(`${podUrl}my-app/data/`, session.fetch);
await overwriteFile(`${podUrl}my-app/data/record.json`, blob, { contentType: 'application/json', fetch: session.fetch });
```

### Delete a container recursively

Solid containers must be empty before deletion. Delete contents first:

```typescript
async function deleteContainerRecursively(
  containerUrl: string,
  fetch: typeof globalThis.fetch
): Promise<void> {
  const dataset = await getSolidDataset(containerUrl, { fetch });
  const resourceUrls = getContainedResourceUrlAll(dataset);

  for (const url of resourceUrls) {
    if (url.endsWith('/')) {
      await deleteContainerRecursively(url, fetch);
    } else {
      await deleteFile(url, { fetch });
    }
  }
  await deleteContainer(containerUrl, { fetch });
}
```

---

## 5. Access grants (delegated access) — v4.x API

Use `@inrupt/solid-client-access-grants` v4.x. Key changes from v3: `getAccessGrantAll` is deprecated in favor of `query`/`paginatedQuery`, `getAccessRequestAll` does not exist, and getter helpers (`getId`, `getRequestor`, `getResources`, `getAccessModes`) should be used instead of accessing VC JSON properties directly.

```typescript
import {
  issueAccessGrant,
  issueAccessRequest,
  approveAccessRequest,
  denyAccessRequest,
  query,
  paginatedQuery,
  revokeAccessGrant,
  getFile,              // fetch a resource using a grant VC
  getId,
  getRequestor,
  getResourceOwner,     // who owns the resource (use on grants you've received)
  getResources,
  getAccessModes,
  getExpirationDate,    // returns Date | null
  getIssuanceDate,      // returns Date | null
  getPurposes,          // returns URL[] (purposes are always URIs)
  getInherit,           // returns boolean — whether grant cascades into containers
  getIssuer,
  DURATION,
  type CredentialResult,
} from '@inrupt/solid-client-access-grants';
import type { DatasetWithId } from '@inrupt/solid-client-vc';

const QUERY_ENDPOINT = new URL('https://vc.inrupt.com/query');
```

### Issuing access requests (as the requestor)

```typescript
// Detect if any resources are containers — if so, set inherit: true
// so the grant cascades to all resources WITHIN the container
const hasContainers = resourceUrls.some(u => u.endsWith('/'));

const request = await issueAccessRequest(
  {
    access: { read: true, write: false, append: false },
    resources: resourceUrls,
    resourceOwner: ownerWebId,   // REQUIRED (not requestor!)
    inherit: hasContainers,      // cascade grant into containers
    // expirationDate: new Date(Date.now() + 86400000),  // optional
  },
  { fetch: session.fetch, returnLegacyJsonld: false }
);
```

**`inherit: true`** means: if a container like `shared-data/` is granted, the grantee can also access all resources inside it. Without `inherit`, the grant only covers the container resource itself (its listing), not the files within. **Always set `inherit: true` when requesting access to containers.**

**Purpose values must be URIs** — the access grants API requires purpose values to be valid URLs. If you have a plain text purpose, wrap it:

```typescript
// purpose must be an array of URI strings
const purposeUrl = looksLikeUrl(purpose)
  ? purpose
  : `https://example.com/${encodeURIComponent(purpose)}`;
params.purpose = [purposeUrl];
```

### Querying access requests/grants (v4 API)

```typescript
// Query pending requests sent to you:
const pendingRequests: CredentialResult = await query(
  { type: 'SolidAccessRequest', status: 'Pending' },
  { fetch: session.fetch, queryEndpoint: QUERY_ENDPOINT }
);

// Use getter helpers to extract ALL info from VCs:
for (const vc of pendingRequests.items) {
  console.log('Request ID:', getId(vc));
  console.log('From:', getRequestor(vc));
  console.log('Resources:', getResources(vc).map(String));  // .map(String) to get plain strings
  console.log('Modes:', getAccessModes(vc));      // { read?: boolean, write?: boolean, append?: boolean }
  console.log('Purposes:', getPurposes(vc));       // URL[] — empty array if none
  console.log('Inherit:', getInherit(vc));         // boolean — cascades into containers?
  console.log('Owner:', getResourceOwner(vc));     // string | undefined
  console.log('Issuer:', getIssuer(vc));           // string | undefined
  console.log('Issued:', getIssuanceDate(vc));     // Date | null
  console.log('Expires:', getExpirationDate(vc));  // Date | null
}

// Query active grants:
const activeGrants = await query(
  { type: 'SolidAccessGrant', status: 'Active' },
  { fetch: session.fetch, queryEndpoint: QUERY_ENDPOINT }
);

// Paginated query (async iterator):
for await (const page of paginatedQuery(
  { type: 'SolidAccessGrant', issuedWithin: DURATION.ONE_WEEK },
  { fetch: session.fetch, queryEndpoint: QUERY_ENDPOINT }
)) {
  for (const vc of page.items) { /* process */ }
}
```

### Approving/denying requests (as the resource owner)

```typescript
// approveAccessRequest takes (vc, overrides?, options?)
await approveAccessRequest(requestVc, undefined, {
  fetch: session.fetch,
  returnLegacyJsonld: false,
});

// denyAccessRequest takes (vc, options?)
await denyAccessRequest(requestVc, { fetch: session.fetch });
```

### Issuing grants directly (no prior request)

```typescript
const grant = await issueAccessGrant(
  {
    requestor: 'https://id.inrupt.com/my-service',
    resources: [`${podUrl}shared-data/`],
    access: { read: true, write: true, append: false },
    inherit: true,  // cascade into container contents
    expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  { fetch: session.fetch }
);
```

### Fetching resources using a grant

**Use `getFile()` from `@inrupt/solid-client-access-grants` (NOT from `@inrupt/solid-client`)** to fetch resources with a grant VC. The grant VC is passed as the second argument and implicitly authorizes the request:

```typescript
import { getFile } from '@inrupt/solid-client-access-grants';

// Fetch a resource the grantee has been given access to
const blob = await getFile(resourceUrl, grantVc, { fetch: session.fetch });
const contentType = blob.type || 'application/octet-stream';

// Text content (Turtle, JSON, JSON-LD, plain text, etc.)
if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/ld+json') {
  const text = await blob.text();
}

// Binary content (images, PDFs, etc.)
const blobUrl = URL.createObjectURL(blob);  // for browser display/download
```

**IMPORTANT:** `getFile` from `@inrupt/solid-client-access-grants` is different from `getFile` in `@inrupt/solid-client`. The access-grants version takes a grant VC as the second parameter to authorize the request. Do not confuse the two.

### Revoke a grant

```typescript
await revokeAccessGrant(grant, { fetch: session.fetch });
```

### Always use `returnLegacyJsonld: false`

Pass `returnLegacyJsonld: false` in options for `issueAccessRequest` and `approveAccessRequest`. This forces the modern JSON-LD format. Without it, you may get legacy format VCs that are harder to work with.

**CRITICAL: When using access grants, the fetch performing the actual data operation must use Bearer auth.** DPoP tokens are bound to a specific URL and will fail when used with grant-delegated requests. See Gotcha #1.

---

## 6. WebSocket notifications (live updates)

```typescript
import { WebsocketNotification } from '@inrupt/solid-client-notifications';

const websocket = new WebsocketNotification(
  `${podUrl}my-app/data/`,
  { fetch: session.fetch }
);

websocket.on('message', (notification) => {
  console.log('Pod changed:', notification);
  // Re-fetch the container to see what changed
});

await websocket.connect();

// Later: clean disconnect
websocket.disconnect();
```

**Tip:** Implement reconnection with exponential backoff. WebSocket connections drop on network changes.

---

## 7. New user provisioning

On Pod Spaces, a brand-new user may not have a WebID or Pod provisioned after their first OIDC login. Check and provision:

```typescript
// 1. Check WebID exists
const webIdResponse = await fetch(session.info.webId, { method: 'HEAD' });
if (webIdResponse.status === 404) {
  // Provision WebID (Pod Spaces specific)
  await fetch(session.info.webId, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// 2. Check Pod exists
const podUrls = await getPodUrlAll(session.info.webId, { fetch: session.fetch });
if (podUrls.length === 0) {
  // Provision storage (Pod Spaces specific)
  // This varies by provider - check provider documentation
}
```

---

## Critical gotchas

### Gotcha #1: Use Bearer tokens, NOT DPoP

**Problem:** DPoP tokens are cryptographically bound to a specific URL. They cannot be reused across different pod URLs or HTTP/2 multiplexed streams. Access grants also require Bearer auth.

**Solution:** Always set `tokenType: 'Bearer'` when calling `session.login()`.

```typescript
await session.login({
  oidcIssuer: 'https://login.inrupt.com',
  redirectUrl: callbackUrl,
  tokenType: 'Bearer',  // ALWAYS set this
});
```

**If you forget this:** You'll get 401 errors when accessing pod resources, especially with access grants or when making concurrent requests.

### Gotcha #2: Pod URL != WebID URL

**Problem:** Developers assume `https://id.inrupt.com/alice` means the pod is at that URL or a derivative.

**Solution:** Always use `getPodUrlAll()`. See section 2 above.

### Gotcha #3: Containers must exist before writing files

**Problem:** `overwriteFile()` does NOT auto-create parent containers. The operation fails silently or returns a 404/409.

**Solution:** Always call `ensureContainerExists()` for every container in the path before writing. See section 4.

### Gotcha #4: Containers must be empty before deletion

**Problem:** `deleteContainer()` fails if the container has any children.

**Solution:** Use recursive deletion (delete files first, then sub-containers, then the container). See section 4.

### Gotcha #5: The Inrupt SDK does not expose the Bearer token directly

**Problem:** If you need the raw Bearer token (e.g., for HTTP/2 clients or non-fetch HTTP libraries), the SDK's `session.fetch` wraps it internally.

**Workaround:** Intercept the Authorization header by wrapping fetch:

```typescript
let capturedToken: string | null = null;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const authHeader = init?.headers?.['Authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    capturedToken = authHeader;
  }
  return originalFetch(input, init);
};

// Trigger an authenticated request to capture the token
await session.fetch(someUrl, { method: 'HEAD' });

// Restore original fetch
globalThis.fetch = originalFetch;

// capturedToken now contains 'Bearer <token>'
```

**Warning:** Use a mutex if multiple requests could run this concurrently.

### Gotcha #6: Cookie size limits for session storage

**Problem:** Serialized session data (tokens + refresh tokens + metadata) often exceeds the 4KB cookie limit.

**Solution:** Chunk the encrypted session across multiple cookies (e.g., `__session.0`, `__session.1`), each under 3800 bytes to leave room for cookie metadata.

### Gotcha #7: Token refresh needs deduplication

**Problem:** Multiple concurrent requests may all detect an expiring token and trigger parallel refreshes, causing refresh token rotation conflicts.

**Solution:** Use a per-session mutex so only one refresh runs at a time:

```typescript
const refreshMutexes = new Map<string, Promise<TokenSet>>();

async function refreshWithDedup(sessionId: string): Promise<TokenSet> {
  if (refreshMutexes.has(sessionId)) {
    return refreshMutexes.get(sessionId)!;
  }
  const promise = doRefresh(sessionId).finally(() => {
    refreshMutexes.delete(sessionId);
  });
  refreshMutexes.set(sessionId, promise);
  return promise;
}
```

### Gotcha #8: DPoP keys are not extractable

**Problem:** The Inrupt SDK generates DPoP keys with `extractable: false`, so you cannot export them for serialization or reuse.

**Solution:** Use `tokenType: 'Bearer'` to avoid DPoP entirely (which you should already be doing per Gotcha #1). If you absolutely need DPoP, track [SDK-3446](https://inrupt.atlassian.net/browse/SDK-3446).

### Gotcha #9: Turtle parsing and ReDoS

**Problem:** If you parse Turtle/RDF responses manually (e.g., for pod traversal), naive regex for nested brackets causes catastrophic backtracking.

**Solution:** Use the Inrupt SDK's built-in parsing (`getSolidDataset` + `getContainedResourceUrlAll`), or write a linear O(n) parser for statement boundaries. Never use regex like `<[^>]*>` on untrusted Turtle.

### Gotcha #10: Client registration on localhost

**Problem:** On localhost, you can't register a proper client ID with a resolvable URL.

**Solution:** Use `clientName` instead of `clientId` for local development. The OIDC provider will use dynamic client registration:

```typescript
await session.login({
  oidcIssuer: 'https://login.inrupt.com',
  redirectUrl: 'http://localhost:3000/auth/callback',
  tokenType: 'Bearer',
  clientName: 'My App (Dev)',  // dynamic registration, no clientId needed
});
```

For production, register a client and use the `clientId`.

---

## Recommended data layout

Structure your app's data in the pod to be self-contained and discoverable:

```
{podUrl}
  my-app/                          # Top-level app container
    settings.jsonld                 # App-level settings
    data/                           # App data container
      record-{uuid}.jsonld          # Individual records
    uploads/                        # User uploads
      file1.pdf
```

**Tips:**
- Use `.jsonld` extension for JSON-LD files with `application/ld+json` content type
- Use UUIDs in resource names to avoid conflicts
- Keep app data under a single top-level container for clean separation
- Create all containers in the path before writing (see Gotcha #3)

---

## Concurrency patterns

When reading many files from a pod, use bounded concurrency to avoid overwhelming the server:

```typescript
async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = fn(item).then((r) => { results.push(r); });
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

// Use with pod operations (10 concurrent requests is a good default)
const files = await mapConcurrent(
  resourceUrls,
  (url) => getFile(url, { fetch: session.fetch }),
  10
);
```

---

## Environment variables

Typical env vars for a Solid app targeting Pod Spaces:

```env
# OIDC Provider
SOLID_OIDC_ISSUER=https://login.inrupt.com

# Client registration (production)
SOLID_CLIENT_ID=<your-registered-client-id>

# Access grants VC provider
SOLID_VC_PROVIDER=https://vc.inrupt.com

# Session encryption
SESSION_ENCRYPTION_KEY=<32-byte-hex-key>
SESSION_SECRET=<random-string>

# App URL (for callbacks)
BACKEND_URL=http://localhost:3000
```

---

### Gotcha #11: Access grants API — no `getAccessRequestAll`, use `query()` in v4

**Problem:** `getAccessRequestAll` does NOT exist in the access grants library (any version). In v3, `getAccessGrantAll` existed but is deprecated in v4. Do NOT try to import `getAccessRequestAll`.

**Solution (v4.x):** Use the `query()` function with a `CredentialFilter`:

```typescript
import { query, getId, getRequestor, getResources, getAccessModes } from '@inrupt/solid-client-access-grants';

const result = await query(
  { type: 'SolidAccessRequest', status: 'Pending' },
  { fetch: session.fetch, queryEndpoint: new URL('https://vc.inrupt.com/query') }
);

// Use getter helpers — do NOT access VC JSON properties directly
for (const vc of result.items) {
  console.log(getId(vc), getRequestor(vc), getResources(vc), getAccessModes(vc));
}
```

**Common mistakes:**
- Importing `getAccessRequestAll` (doesn't exist — compile error)
- Passing `{ fetch }` as the first arg to `query` (first arg is the filter, second is options)
- Accessing `vc.credentialSubject.id` directly instead of using `getRequestor(vc)`
- Expecting `getAccessModes()` to return `{ read: boolean }` — it returns `{ read?: boolean }` (optional booleans)

### Gotcha #12: `inherit: true` is required for container access grants

**Problem:** You request access to a container (`shared-data/`) but when the grant is approved, you can only list the container — you can't read any files inside it.

**Solution:** Set `inherit: true` when issuing the access request or grant. Without it, the grant only covers the container resource itself (its RDF listing), not the resources within it.

```typescript
// CORRECT: inherit lets the grant cascade to container contents
await issueAccessRequest({
  access: { read: true },
  resources: [`${podUrl}shared-data/`],
  resourceOwner: ownerWebId,
  inherit: true,  // REQUIRED for container access
}, { fetch, returnLegacyJsonld: false });

// Pattern: auto-detect containers and set inherit accordingly
const hasContainers = resources.some(u => u.endsWith('/'));
params.inherit = hasContainers;
```

**Also:** Use `getInherit(vc)` to check whether a received request/grant has inherit set.

### Gotcha #13: Two different `getFile` functions

**Problem:** Both `@inrupt/solid-client` and `@inrupt/solid-client-access-grants` export a `getFile` function. Using the wrong one when fetching grant-authorized resources gives 403 errors.

**Solution:** When fetching a resource via an access grant, use the `getFile` from `@inrupt/solid-client-access-grants`, which takes the grant VC as its second parameter:

```typescript
// CORRECT: access-grants getFile (takes grantVc)
import { getFile } from '@inrupt/solid-client-access-grants';
const blob = await getFile(resourceUrl, grantVc, { fetch });

// WRONG: solid-client getFile (no grant VC — will 403 on granted resources)
import { getFile } from '@inrupt/solid-client';
const blob = await getFile(resourceUrl, { fetch });  // 403!
```

### Gotcha #14: `setPublicAccess` is in `@inrupt/solid-client/universal`

**Problem:** The universal access API (`setPublicAccess`, `setAgentAccess`) is not a top-level export of `@inrupt/solid-client`. Importing from the wrong path gives compile errors.

**Solution:** Import from the `/universal` subpath:

```typescript
import { setPublicAccess } from '@inrupt/solid-client/universal';

await setPublicAccess(resourceUrl, { read: true }, { fetch: session.fetch });
```

---

## Debugging tips

1. **401 on pod access?** Check `tokenType: 'Bearer'` in login. Check that you're passing `{ fetch: session.fetch }` (not bare `fetch`).
2. **Empty `getPodUrlAll()` result?** The WebID profile may not have `pim:storage`. Check the WebID document manually: `curl -H "Accept: text/turtle" <webId>`.
3. **404 on write?** Parent container doesn't exist. Use `ensureContainerExists()`.
4. **409 Conflict?** Concurrent writes to the same resource. Add retry logic or use ETags.
5. **CORS errors in browser?** Pod Spaces supports CORS, but your OIDC issuer URL must match. Check `oidcIssuer` value.
6. **Refresh token fails?** Token rotation may have already occurred. Clear session and re-authenticate.
