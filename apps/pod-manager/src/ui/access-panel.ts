import type { AccessRequestInfo } from "../access-grants.js";
import { escapeHtml } from "@solid-ecosystem/shared";

export function renderAccessPanel(
  container: HTMLElement,
  requests: AccessRequestInfo[],
  onApprove: (id: string) => void,
  onDeny: (id: string) => void,
  onRefresh?: () => void
): void {
  container.innerHTML = "";

  // Refresh button
  if (onRefresh) {
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "btn btn-secondary btn-sm refresh-btn";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing...";
      onRefresh();
    });
    container.appendChild(refreshBtn);
  }

  if (requests.length === 0) {
    const msg = document.createElement("p");
    msg.className = "muted";
    msg.textContent = "No pending access requests.";
    container.appendChild(msg);
    return;
  }

  for (const req of requests) {
    const card = document.createElement("div");
    card.className = "access-card";

    const requestDate = req.requestedAt
      ? new Date(req.requestedAt).toLocaleString()
      : null;

    const expiry = req.expiresAt
      ? new Date(req.expiresAt).toLocaleString()
      : "No expiration";

    const purposeText = req.purposes.length > 0
      ? req.purposes.map(formatPurpose).join(", ")
      : "None specified";
    const purposeHtml = `<p class="request-purpose">Purpose: ${escapeHtml(purposeText)}</p>`;

    const inheritNote = req.inherit
      ? ` <span class="badge badge-info" title="Access will cascade to all resources within requested containers">+ children</span>`
      : "";

    const metaItems: string[] = [];
    if (requestDate) metaItems.push(`<span>Requested: ${requestDate}</span>`);
    metaItems.push(`<span>Expires: ${expiry}</span>`);
    if (req.resourceOwner) metaItems.push(`<span>Owner: ${escapeHtml(shortenWebId(req.resourceOwner))}</span>`);
    if (req.issuer) metaItems.push(`<span>Issuer: ${escapeHtml(shortenHost(req.issuer))}</span>`);
    metaItems.push(`<span>ID: <code title="${escapeHtml(req.id)}">${escapeHtml(shortenUrl(req.id))}</code></span>`);

    card.innerHTML = `
      <div class="access-info">
        <div class="request-header">
          <strong>${escapeHtml(req.requestorWebId)}</strong>
        </div>
        ${purposeHtml}
        <p>
          ${req.modes.map((m) => `<span class="badge badge-mode">${m}</span>`).join(" ")}
          ${inheritNote}
        </p>
        <div class="request-meta">
          ${metaItems.join(" &middot; ")}
        </div>
        <ul class="resource-list">
          ${req.resourceUrls.map((u) => `<li title="${escapeHtml(u)}">${escapeHtml(shortenUrl(u))}</li>`).join("")}
        </ul>
      </div>
      <div class="access-actions">
        <button class="btn btn-primary approve-btn" data-id="${req.id}">Approve</button>
        <button class="btn btn-danger deny-btn" data-id="${req.id}">Deny</button>
      </div>
    `;

    card
      .querySelector(".approve-btn")!
      .addEventListener("click", () => onApprove(req.id));
    card
      .querySelector(".deny-btn")!
      .addEventListener("click", () => onDeny(req.id));

    container.appendChild(card);
  }
}

/** Show just the path portion of a pod URL for readability */
function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}

/** Extract a human-readable label from a purpose URI */
function formatPurpose(uri: string): string {
  try {
    const u = new URL(uri);
    // If it's our example.com convention, decode the path back to the original string
    if (u.hostname === "example.com" && u.pathname.length > 1) {
      return decodeURIComponent(u.pathname.slice(1));
    }
    // Otherwise show the full URI
    return uri;
  } catch {
    return uri;
  }
}

function shortenHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function shortenWebId(webId: string): string {
  try {
    const u = new URL(webId);
    return u.pathname === "/" ? u.hostname : `${u.hostname}${u.pathname}`;
  } catch {
    return webId;
  }
}
