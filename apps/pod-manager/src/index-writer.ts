import {
  saveSolidDatasetAt,
  getSolidDataset,
  setThing,
  getThingAll,
  removeThing,
  type SolidDataset,
} from "@inrupt/solid-client";
import { setPublicAccess } from "@inrupt/solid-client/universal";
import { POD_INDEX_PREFIXES } from "@solid-ecosystem/shared";

export async function writeIndexToPod(
  indexUrl: string,
  dataset: SolidDataset,
  authFetch: typeof fetch
): Promise<string> {
  // Try to fetch the existing dataset so saveSolidDatasetAt gets the ETag
  // for conditional update. Without this, a fresh dataset causes
  // If-None-Match: * which returns 412 if the file already exists.
  let targetDataset: SolidDataset;
  try {
    const existing = await getSolidDataset(indexUrl, { fetch: authFetch });
    // Clear existing things and replace with new ones
    targetDataset = existing;
    for (const thing of getThingAll(targetDataset)) {
      targetDataset = removeThing(targetDataset, thing);
    }
    for (const thing of getThingAll(dataset)) {
      targetDataset = setThing(targetDataset, thing);
    }
  } catch {
    // File doesn't exist yet, use the fresh dataset
    targetDataset = dataset;
  }

  await saveSolidDatasetAt(indexUrl, targetDataset, {
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
