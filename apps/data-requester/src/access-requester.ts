import { issueAccessRequest } from "@inrupt/solid-client-access-grants";

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
    params.purpose = [purpose];
  }

  return issueAccessRequest(params, {
    fetch: authFetch,
    returnLegacyJsonld: false,
  });
}
