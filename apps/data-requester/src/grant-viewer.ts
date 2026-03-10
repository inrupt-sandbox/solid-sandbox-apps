export interface GrantInfo {
  id: string;
  ownerWebId: string;
  resourceUrls: string[];
  modes: string[];
  expiresAt: string | null;
  issuedAt: string | null;
}

export interface ResourceContent {
  contentType: string;
  text: string | null;
  blobUrl: string | null;
}

export const TEXT_TYPES = ["text/", "application/json", "application/ld+json", "text/turtle"];

export function isTextContentType(contentType: string): boolean {
  return TEXT_TYPES.some((t) => contentType.startsWith(t));
}

export async function fetchReceivedGrants(): Promise<GrantInfo[]> {
  try {
    const res = await fetch("/api/grants");
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch received grants:", err);
    return [];
  }
}

export async function listContainerContents(
  containerUrl: string,
  grantId: string
): Promise<string[]> {
  const res = await fetch("/api/list-container", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ containerUrl, grantId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to list container");
  }

  return res.json();
}

export async function fetchGrantedResource(
  resourceUrl: string,
  grantId: string
): Promise<ResourceContent> {
  const res = await fetch("/api/fetch-resource", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceUrl, grantId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to fetch resource");
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";

  // If the response is JSON with our text wrapper
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (data.contentType !== undefined) {
      return data as ResourceContent;
    }
  }

  // Binary response
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { contentType, text: null, blobUrl };
}
