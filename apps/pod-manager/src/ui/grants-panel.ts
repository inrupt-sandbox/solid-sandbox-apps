import type { ActiveGrantInfo } from "../access-grants.js";
import { escapeHtml } from "@solid-ecosystem/shared";

export function renderGrantsPanel(
  container: HTMLElement,
  grants: ActiveGrantInfo[],
  onRevoke: (id: string) => void
): void {
  if (grants.length === 0) {
    container.innerHTML = `<p class="muted">No active grants.</p>`;
    return;
  }

  container.innerHTML = "";

  for (const grant of grants) {
    const card = document.createElement("div");
    card.className = "access-card";

    const expiry = grant.expiresAt
      ? new Date(grant.expiresAt).toLocaleDateString()
      : "No expiration";

    const issued = grant.issuedAt
      ? new Date(grant.issuedAt).toLocaleString()
      : null;

    card.innerHTML = `
      <div class="access-info">
        <div class="request-header">
          <strong>Granted to: ${escapeHtml(grant.granteeWebId)}</strong>
          ${issued ? `<span class="request-date">issued ${issued}</span>` : ""}
        </div>
        <p>
          ${grant.modes.map((m) => `<span class="badge badge-mode">${m}</span>`).join(" ")}
          &middot; Expires: ${expiry}
        </p>
        <ul class="resource-list">
          ${grant.resourceUrls.map((u) => `<li title="${escapeHtml(u)}">${escapeHtml(shortenUrl(u))}</li>`).join("")}
        </ul>
      </div>
      <div class="access-actions">
        <button class="btn btn-danger revoke-btn" data-id="${grant.id}">Revoke</button>
      </div>
    `;

    card
      .querySelector(".revoke-btn")!
      .addEventListener("click", () => onRevoke(grant.id));

    container.appendChild(card);
  }
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}
