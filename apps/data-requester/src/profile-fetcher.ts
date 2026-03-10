import {
  getSolidDataset,
  getThing,
  getUrlAll,
  getUrl,
} from "@inrupt/solid-client";
import { SOLID, FOAF } from "@solid-ecosystem/shared";

export interface ProfileInfo {
  webId: string;
  name?: string;
  publicTypeIndexUrl?: string;
}

export async function fetchProfile(
  webId: string,
  authFetch?: typeof fetch
): Promise<ProfileInfo> {
  const fetchOpts = authFetch ? { fetch: authFetch } : {};
  const dataset = await getSolidDataset(webId, fetchOpts);
  const profile = getThing(dataset, webId);

  if (!profile) {
    return { webId };
  }

  const name = getUrl(profile, FOAF.name) ?? undefined;
  const publicTypeIndexUrl =
    getUrl(profile, SOLID.publicTypeIndex) ?? undefined;

  return { webId, name, publicTypeIndexUrl };
}
