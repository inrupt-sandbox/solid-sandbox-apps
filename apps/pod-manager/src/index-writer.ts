import { saveSolidDatasetAt, type SolidDataset } from "@inrupt/solid-client";
import { setPublicAccess } from "@inrupt/solid-client/universal";
import { POD_INDEX_PREFIXES } from "@solid-ecosystem/shared";

export async function writeIndexToPod(
  indexUrl: string,
  dataset: SolidDataset,
  authFetch: typeof fetch
): Promise<string> {
  await saveSolidDatasetAt(indexUrl, dataset, {
    fetch: authFetch,
    prefixes: POD_INDEX_PREFIXES,
  });

  // Set public read access
  try {
    await setPublicAccess(indexUrl, { read: true }, { fetch: authFetch });
  } catch (err) {
    console.warn("Could not set public access on index:", err);
  }

  return indexUrl;
}
