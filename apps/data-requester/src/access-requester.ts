import { issueAccessRequest } from "@inrupt/solid-client-access-grants";

function looksLikeUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function requestAccess(
  resourceUrls: string[],
  ownerWebId: string,
  modes: ("Read" | "Write" | "Append")[],
  authFetch: typeof fetch,
  purpose?: string
): Promise<any> {
  // Check if any selected resources are containers (end with /)
  const hasContainers = resourceUrls.some((u) => u.endsWith("/"));

  const params: any = {
    access: {
      read: modes.includes("Read"),
      write: modes.includes("Write"),
      append: modes.includes("Append"),
    },
    resources: resourceUrls,
    resourceOwner: ownerWebId,
    inherit: hasContainers, // Cascade grant to resources within containers
  };

  if (purpose) {
    // Purposes must be URIs — if the user typed a plain string, make it a URL
    const purposeUrl = looksLikeUrl(purpose)
      ? purpose
      : `https://example.com/${encodeURIComponent(purpose)}`;
    params.purpose = [purposeUrl];
  }

  return issueAccessRequest(params, {
    fetch: authFetch,
    returnLegacyJsonld: false,
  });
}
