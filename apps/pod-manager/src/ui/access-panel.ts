import type { AccessRequestInfo } from "../access-grants.js";

export function renderAccessPanel(
  container: HTMLElement,
  requests: AccessRequestInfo[],
  onApprove: (id: string) => void,
  onDeny: (id: string) => void
): void {
  if (requests.length === 0) {
    container.innerHTML = `<p class="muted">No pending access requests.</p>`;
    return;
  }

  container.innerHTML = "";

  for (const req of requests) {
    const card = document.createElement("div");
    card.className = "access-card";

    const requestDate = req.requestedAt
      ? new Date(req.requestedAt).toLocaleString()
      : null;

    const purposeHtml = req.purposes.length > 0
      ? `<p class="request-purpose">${escapeHtml(req.purposes.join(", "))}</p>`
      : "";

    const inheritNote = req.inherit
      ? ` <span class="badge badge-info" title="Access will cascade to all resources within requested containers">+ children</span>`
      : "";

    card.innerHTML = `
      <div class="access-info">
        <div class="request-header">
          <strong>${escapeHtml(req.requestorWebId)}</strong>
          ${requestDate ? `<span class="request-date">${requestDate}</span>` : ""}
        </div>
        ${purposeHtml}
        <p>
          ${req.modes.map((m) => `<span class="badge badge-mode">${m}</span>`).join(" ")}
          ${inheritNote}
        </p>
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
