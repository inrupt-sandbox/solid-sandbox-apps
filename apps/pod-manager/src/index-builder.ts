import type { PodIndex, PodResource } from "@solid-ecosystem/shared";
import { buildPodIndexDataset } from "@solid-ecosystem/shared";
import type { SolidDataset } from "@inrupt/solid-client";

export function buildIndex(
  webId: string,
  podUrl: string,
  resources: PodResource[]
): { index: PodIndex; dataset: SolidDataset; indexUrl: string } {
  const index: PodIndex = {
    webId,
    podUrl,
    resources,
    updatedAt: new Date().toISOString(),
  };

  const indexUrl = podUrl.endsWith("/")
    ? `${podUrl}public-index.ttl`
    : `${podUrl}/public-index.ttl`;

  const dataset = buildPodIndexDataset(index, indexUrl);
  return { index, dataset, indexUrl };
}
