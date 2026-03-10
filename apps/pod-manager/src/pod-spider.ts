import {
  getSolidDataset,
  getContainedResourceUrlAll,
  getContentType,
} from "@inrupt/solid-client";
import { getPodUrlAll } from "@inrupt/solid-client";
import type { PodResource } from "@solid-ecosystem/shared";

const MAX_CONCURRENCY = 5;

export interface SpiderProgress {
  discovered: number;
  fetched: number;
  errors: number;
}

type ProgressCallback = (progress: SpiderProgress) => void;

export async function spiderPod(
  webId: string,
  authFetch: typeof fetch,
  onProgress?: ProgressCallback
): Promise<PodResource[]> {
  const podUrls = await getPodUrlAll(webId, { fetch: authFetch });
  if (podUrls.length === 0) {
    throw new Error("No pod URLs found for this WebID");
  }

  const resources: PodResource[] = [];
  const queue: string[] = [...podUrls];
  const visited = new Set<string>();
  const progress: SpiderProgress = { discovered: 0, fetched: 0, errors: 0 };

  async function processContainer(containerUrl: string): Promise<string[]> {
    if (visited.has(containerUrl)) return [];
    visited.add(containerUrl);

    try {
      const dataset = await getSolidDataset(containerUrl, {
        fetch: authFetch,
      });
      progress.fetched++;

      resources.push({ url: containerUrl, type: "container" });

      const contained = getContainedResourceUrlAll(dataset);
      const childContainers: string[] = [];

      for (const url of contained) {
        if (url.endsWith("/")) {
          childContainers.push(url);
          progress.discovered++;
        } else {
          resources.push({
            url,
            type: "resource",
          });
          progress.discovered++;
        }
      }

      onProgress?.(progress);
      return childContainers;
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.statusCode === 403) {
        // Skip forbidden containers
        progress.errors++;
        onProgress?.(progress);
        return [];
      }
      progress.errors++;
      onProgress?.(progress);
      return [];
    }
  }

  // Process with concurrency limit
  while (queue.length > 0) {
    const batch = queue.splice(0, MAX_CONCURRENCY);
    const results = await Promise.all(batch.map(processContainer));
    for (const childContainers of results) {
      queue.push(...childContainers);
    }
  }

  return resources;
}

export function getPodUrl(resources: PodResource[]): string | undefined {
  // The first container is the pod root
  return resources.find((r) => r.type === "container")?.url;
}
