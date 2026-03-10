import type { ActiveGrantInfo } from "../access-grants.js";

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

    card.innerHTML = `
      <div class="access-info">
        <strong>Granted to: ${escapeHtml(grant.granteeWebId)}</strong>
        <p>Modes: ${grant.modes.join(", ")} &middot; Expires: ${expiry}</p>
        <ul>
          ${grant.resourceUrls.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
