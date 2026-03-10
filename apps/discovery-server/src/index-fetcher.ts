import type { PodIndex } from "@solid-ecosystem/shared";
import { parsePodIndexFromDataset } from "@solid-ecosystem/shared";
import { getSolidDataset } from "@inrupt/solid-client";

export async function fetchPublicIndex(
  podUrl: string
): Promise<PodIndex | null> {
  const indexUrl = podUrl.endsWith("/")
    ? `${podUrl}public-index.ttl`
    : `${podUrl}/public-index.ttl`;

  try {
    const dataset = await getSolidDataset(indexUrl);
    return parsePodIndexFromDataset(dataset, indexUrl);
  } catch {
    return null;
  }
}
