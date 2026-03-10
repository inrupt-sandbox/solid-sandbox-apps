import type { PodIndex, PodResource } from "./types.js";
import { POD_INDEX, RDF } from "./vocab.js";
import {
  createSolidDataset,
  buildThing,
  setThing,
  getThing,
  getThingAll,
  getStringNoLocale,
  getUrl,
  getUrlAll,
  getDatetime,
  type SolidDataset,
} from "@inrupt/solid-client";

const PREFIXES: Record<string, string> = {
  pi: "http://example.org/pod-index#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

export function buildPodIndexDataset(index: PodIndex, baseUrl: string): SolidDataset {
  let dataset = createSolidDataset();

  // Build the index Thing
  let indexBuilder = buildThing({ url: `${baseUrl}#index` })
    .addUrl(RDF.type, POD_INDEX.PodIndex)
    .addStringNoLocale(POD_INDEX.webId, index.webId)
    .addStringNoLocale(POD_INDEX.podUrl, index.podUrl)
    .addDatetime(POD_INDEX.updatedAt, new Date(index.updatedAt));

  // Add resource references
  for (let i = 0; i < index.resources.length; i++) {
    indexBuilder = indexBuilder.addUrl(POD_INDEX.resource, `${baseUrl}#res${i}`);
  }

  dataset = setThing(dataset, indexBuilder.build());

  // Build each resource Thing
  for (let i = 0; i < index.resources.length; i++) {
    const res = index.resources[i];
    let resBuilder = buildThing({ url: `${baseUrl}#res${i}` })
      .addUrl(RDF.type, POD_INDEX.PodResource)
      .addStringNoLocale(POD_INDEX.resourceUrl, res.url)
      .addStringNoLocale(POD_INDEX.resourceType, res.type);

    if (res.contentType) {
      resBuilder = resBuilder.addStringNoLocale(POD_INDEX.contentType, res.contentType);
    }

    dataset = setThing(dataset, resBuilder.build());
  }

  return dataset;
}

export function parsePodIndexFromDataset(dataset: SolidDataset, baseUrl: string): PodIndex | null {
  const indexThing = getThing(dataset, `${baseUrl}#index`);
  if (!indexThing) return null;

  const typeUrl = getUrl(indexThing, RDF.type);
  if (typeUrl !== POD_INDEX.PodIndex) return null;

  const webId = getStringNoLocale(indexThing, POD_INDEX.webId) ?? "";
  const podUrl = getStringNoLocale(indexThing, POD_INDEX.podUrl) ?? "";
  const updatedAtDate = getDatetime(indexThing, POD_INDEX.updatedAt);
  const updatedAt = updatedAtDate?.toISOString() ?? "";

  const resourceUrls = getUrlAll(indexThing, POD_INDEX.resource);

  const resources: PodResource[] = resourceUrls.map((resUrl) => {
    const resThing = getThing(dataset, resUrl);
    const url = resThing ? getStringNoLocale(resThing, POD_INDEX.resourceUrl) ?? "" : "";
    const type = (resThing ? getStringNoLocale(resThing, POD_INDEX.resourceType) ?? "resource" : "resource") as "container" | "resource";
    const contentType = resThing ? getStringNoLocale(resThing, POD_INDEX.contentType) ?? undefined : undefined;
    return { url, type, contentType };
  });

  return { webId, podUrl, resources, updatedAt };
}

export { PREFIXES as POD_INDEX_PREFIXES };
