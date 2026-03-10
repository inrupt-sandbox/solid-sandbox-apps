import {
  query,
  approveAccessRequest,
  denyAccessRequest,
  revokeAccessGrant,
  getRequestor,
  getResources,
  getAccessModes,
  getExpirationDate,
  getIssuanceDate,
  getId,
  getPurposes,
  getInherit,
  type CredentialResult,
} from "@inrupt/solid-client-access-grants";
import type { DatasetWithId } from "@inrupt/solid-client-vc";

const QUERY_ENDPOINT = new URL("https://vc.inrupt.com/query");

export interface AccessRequestInfo {
  id: string;
  requestorWebId: string;
  resourceUrls: string[];
  modes: string[];
  purposes: string[];
  requestedAt: string | null;
  inherit: boolean;
  vc: DatasetWithId;
}

export async function fetchAccessRequests(
  authFetch: typeof fetch
): Promise<AccessRequestInfo[]> {
  try {
    const result: CredentialResult = await query(
      { type: "SolidAccessRequest", status: "Pending" },
      { fetch: authFetch, queryEndpoint: QUERY_ENDPOINT }
    );

    return result.items.map((vc) => {
      const issDate = getIssuanceDate(vc);
      return {
        id: getId(vc),
        requestorWebId: getRequestor(vc),
        resourceUrls: getResources(vc).map(String),
        modes: formatModes(getAccessModes(vc)),
        purposes: getPurposes(vc).map(String),
        requestedAt: issDate ? issDate.toISOString() : null,
        inherit: getInherit(vc),
        vc,
      };
    });
  } catch (err) {
    console.error("Failed to fetch access requests:", err);
    return [];
  }
}

export async function approveRequest(
  requestVc: DatasetWithId,
  authFetch: typeof fetch
): Promise<void> {
  await approveAccessRequest(requestVc, undefined, {
    fetch: authFetch,
    returnLegacyJsonld: false,
  });
}

export async function denyRequest(
  requestVc: DatasetWithId,
  authFetch: typeof fetch
): Promise<void> {
  await denyAccessRequest(requestVc, {
    fetch: authFetch,
  });
}

export interface ActiveGrantInfo {
  id: string;
  granteeWebId: string;
  resourceUrls: string[];
  modes: string[];
  expiresAt: string | null;
  issuedAt: string | null;
  vc: DatasetWithId;
}

export async function fetchActiveGrants(
  authFetch: typeof fetch
): Promise<ActiveGrantInfo[]> {
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
        granteeWebId: getRequestor(vc),
        resourceUrls: getResources(vc).map(String),
        modes: formatModes(getAccessModes(vc)),
        expiresAt: expDate ? expDate.toISOString() : null,
        issuedAt: issDate ? issDate.toISOString() : null,
        vc,
      };
    });
  } catch (err) {
    console.error("Failed to fetch active grants:", err);
    return [];
  }
}

export async function revokeGrant(
  grantVc: DatasetWithId,
  authFetch: typeof fetch
): Promise<void> {
  await revokeAccessGrant(grantVc, { fetch: authFetch });
}

function formatModes(modes: { read?: boolean; write?: boolean; append?: boolean }): string[] {
  const result: string[] = [];
  if (modes.read) result.push("Read");
  if (modes.write) result.push("Write");
  if (modes.append) result.push("Append");
  return result;
}
