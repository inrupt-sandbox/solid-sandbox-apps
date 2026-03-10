import type { PodIndex } from "@solid-ecosystem/shared";
import { DiscoveryClient, parsePodIndexFromDataset } from "@solid-ecosystem/shared";
import { getPodUrlAll, getSolidDataset } from "@inrupt/solid-client";

const discovery = new DiscoveryClient();

export async function fetchPodIndex(
  webId: string,
  authFetch?: typeof fetch
): Promise<PodIndex | null> {
  // Strategy 1: Try to get pod URL and fetch index directly
  try {
    const fetchOpts = authFetch ? { fetch: authFetch } : {};
    const podUrls = await getPodUrlAll(webId, fetchOpts);

    for (const podUrl of podUrls) {
      const indexUrl = podUrl.endsWith("/")
        ? `${podUrl}public-index.ttl`
        : `${podUrl}/public-index.ttl`;

      try {
        const dataset = await getSolidDataset(indexUrl, fetchOpts);
        const index = parsePodIndexFromDataset(dataset, indexUrl);
        if (index) return index;
      } catch {
        // Try next pod URL
      }
    }
  } catch {
    // Fall through to discovery
  }

  // Strategy 2: Look up in discovery server
  try {
    const entries = await discovery.search(webId);
    const match = entries.find((e) => e.webId === webId);
    if (match?.index) return match.index;
  } catch {
    // Discovery server might be offline
  }

  return null;
}
