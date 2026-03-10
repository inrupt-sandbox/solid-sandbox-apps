import { getPodUrlAll } from "@inrupt/solid-client";
import type { PodResource } from "@solid-ecosystem/shared";

// HTTP/2 multiplexes requests over a single connection, so we can safely
// run many more concurrent fetches than with HTTP/1.1's 6-connection limit.
const MAX_CONCURRENCY = 20;

export interface SpiderProgress {
  discovered: number;
  fetched: number;
  errors: number;
}

type ProgressCallback = (progress: SpiderProgress) => void;
type ResourcesCallback = (resources: PodResource[]) => void;

/** Parse ldp:contains URLs out of a Turtle container response. */
export function parseContainedUrls(turtle: string, containerUrl: string): string[] {
  const urls: string[] = [];

  // Match <url> in ldp:contains block (handles multi-object comma lists)
  const containsBlock = turtle.match(
    /ldp:contains\s+([\s\S]*?)(?:\.\s*$|\.\s*\n)/m
  );
  if (containsBlock) {
    for (const m of containsBlock[1].matchAll(/<([^>]+)>/g)) {
      urls.push(m[1]);
    }
  }

  // Also try individual triples (some serialisers emit one triple per resource)
  const individualPattern = /ldp:contains\s+<([^>]+)>/g;
  let match;
  while ((match = individualPattern.exec(turtle)) !== null) {
    if (!urls.includes(match[1])) {
      urls.push(match[1]);
    }
  }

  // Resolve relative URLs
  return urls.map((u) => {
    try {
      return new URL(u, containerUrl).href;
    } catch {
      return u;
    }
  });
}

export async function spiderPod(
  webId: string,
  authFetch: typeof fetch,
  onProgress?: ProgressCallback,
  onResources?: ResourcesCallback
): Promise<PodResource[]> {
  const podUrls = await getPodUrlAll(webId, { fetch: authFetch });
  if (podUrls.length === 0) {
    throw new Error("No pod URLs found for this WebID");
  }

  const resources: PodResource[] = [];
  const visited = new Set<string>();
  const progress: SpiderProgress = { discovered: 0, fetched: 0, errors: 0 };

  // Sliding-window concurrent queue — always keeps MAX_CONCURRENCY in flight
  let queue: string[] = [...podUrls];
  let inFlight = 0;
  let resolveIdle: (() => void) | null = null;

  function scheduleNext(): void {
    while (inFlight < MAX_CONCURRENCY && queue.length > 0) {
      const url = queue.shift()!;
      if (visited.has(url)) {
        continue;
      }
      visited.add(url);
      inFlight++;
      processContainer(url).then(() => {
        inFlight--;
        onResources?.(resources);
        if (queue.length > 0) {
          scheduleNext();
        } else if (inFlight === 0 && resolveIdle) {
          resolveIdle();
        }
      });
    }
    // If nothing was scheduled and nothing in flight, resolve immediately
    if (inFlight === 0 && queue.length === 0 && resolveIdle) {
      resolveIdle();
    }
  }

  async function processContainer(containerUrl: string): Promise<void> {
    try {
      const resp = await authFetch(containerUrl, {
        headers: { Accept: "text/turtle" },
      });

      if (!resp.ok) {
        if (resp.status === 403) {
          progress.errors++;
          onProgress?.(progress);
          return;
        }
        progress.errors++;
        onProgress?.(progress);
        return;
      }

      const turtle = await resp.text();
      progress.fetched++;

      resources.push({ url: containerUrl, type: "container" });

      const contained = parseContainedUrls(turtle, containerUrl);

      for (const url of contained) {
        if (url.endsWith("/")) {
          if (!visited.has(url)) {
            queue.push(url);
          }
          progress.discovered++;
        } else {
          resources.push({ url, type: "resource" });
          progress.discovered++;
        }
      }

      onProgress?.(progress);
      // Kick off newly discovered containers
      scheduleNext();
    } catch {
      progress.errors++;
      onProgress?.(progress);
    }
  }

  // Wait for all work to complete
  await new Promise<void>((resolve) => {
    resolveIdle = resolve;
    scheduleNext();
  });

  return resources;
}

export function getPodUrl(resources: PodResource[]): string | undefined {
  // The first container is the pod root
  return resources.find((r) => r.type === "container")?.url;
}
