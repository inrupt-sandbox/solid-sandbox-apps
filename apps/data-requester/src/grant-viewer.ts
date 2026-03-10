import {
  query,
  getFile,
  getId,
  getRequestor,
  getResourceOwner,
  getResources,
  getAccessModes,
  getExpirationDate,
  getIssuanceDate,
  type CredentialResult,
} from "@inrupt/solid-client-access-grants";
import type { DatasetWithId } from "@inrupt/solid-client-vc";

const QUERY_ENDPOINT = new URL("https://vc.inrupt.com/query");

export interface GrantInfo {
  id: string;
  ownerWebId: string;
  resourceUrls: string[];
  modes: string[];
  expiresAt: string | null;
  issuedAt: string | null;
  vc: DatasetWithId;
}

export async function fetchReceivedGrants(
  authFetch: typeof fetch
): Promise<GrantInfo[]> {
  try {
    const result: CredentialResult = await query(
      { type: "SolidAccessGrant", status: "Active" },
      { fetch: authFetch, queryEndpoint: QUERY_ENDPOINT }
    );

    return result.items.map((vc) => {
      const expDate = getExpirationDate(vc);
      const issDate = getIssuanceDate(vc);
      return {
        id: getId(vc),
        ownerWebId: getResourceOwner(vc) ?? "Unknown",
        resourceUrls: getResources(vc).map(String),
        modes: formatModes(getAccessModes(vc)),
        expiresAt: expDate ? expDate.toISOString() : null,
        issuedAt: issDate ? issDate.toISOString() : null,
        vc,
      };
    });
  } catch (err) {
    console.error("Failed to fetch received grants:", err);
    return [];
  }
}

export interface ResourceContent {
  contentType: string;
  text: string | null;
  blobUrl: string | null;
}

const TEXT_TYPES = ["text/", "application/json", "application/ld+json", "text/turtle"];

function isTextContent(contentType: string): boolean {
  return TEXT_TYPES.some((t) => contentType.startsWith(t));
}

export async function fetchGrantedResource(
  resourceUrl: string,
  grantVc: DatasetWithId,
  authFetch: typeof fetch
): Promise<ResourceContent> {
  const blob = await getFile(resourceUrl, grantVc, { fetch: authFetch });
  const contentType = blob.type || "application/octet-stream";

  if (isTextContent(contentType)) {
    const text = await blob.text();
    return { contentType, text, blobUrl: null };
  }

  const blobUrl = URL.createObjectURL(blob);
  return { contentType, text: null, blobUrl };
}

function formatModes(modes: { read?: boolean; write?: boolean; append?: boolean }): string[] {
  const result: string[] = [];
  if (modes.read) result.push("Read");
  if (modes.write) result.push("Write");
  if (modes.append) result.push("Append");
  return result;
}
