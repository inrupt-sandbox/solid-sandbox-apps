import type { PodIndex } from "@solid-ecosystem/shared";
import { DiscoveryClient } from "@solid-ecosystem/shared";

const discovery = new DiscoveryClient();

export async function fetchPodIndex(
  webId: string
): Promise<PodIndex | null> {
  // Strategy 1: Fetch via server (which has authenticated session)
  try {
    const res = await fetch(`/api/pod-index?webId=${encodeURIComponent(webId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
  } catch {
    // Fall through to discovery
  }

  // Strategy 2: Look up in discovery server (public, no auth needed)
  try {
    const entries = await discovery.search(webId);
    const match = entries.find((e) => e.webId === webId);
    if (match?.index) return match.index;
  } catch {
    // Discovery server might be offline
  }

  return null;
}
