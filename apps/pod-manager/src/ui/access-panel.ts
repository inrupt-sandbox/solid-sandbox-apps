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
    card.innerHTML = `
      <div class="access-info">
        <strong>${escapeHtml(req.requestorWebId)}</strong>
        <p>Requesting: ${req.modes.join(", ")} access to:</p>
        <ul>
          ${req.resourceUrls.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
