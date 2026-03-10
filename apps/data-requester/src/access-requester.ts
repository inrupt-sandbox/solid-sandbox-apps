export async function requestAccess(
  resourceUrls: string[],
  ownerWebId: string,
  modes: ("Read" | "Write" | "Append")[],
  purpose?: string
): Promise<any> {
  const res = await fetch("/api/request-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceUrls, ownerWebId, modes, purpose }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to send access request");
  }

  return res.json();
}
