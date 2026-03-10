import { issueAccessRequest } from "@inrupt/solid-client-access-grants";

export async function requestAccess(
  resourceUrls: string[],
  ownerWebId: string,
  modes: ("Read" | "Write" | "Append")[],
  authFetch: typeof fetch,
  purpose?: string
): Promise<any> {
  const params: any = {
    access: {
      read: modes.includes("Read"),
      write: modes.includes("Write"),
      append: modes.includes("Append"),
    },
    resources: resourceUrls,
    resourceOwner: ownerWebId,
  };

  if (purpose) {
    params.purpose = [purpose];
  }

  return issueAccessRequest(params, {
    fetch: authFetch,
    returnLegacyJsonld: false,
  });
}
