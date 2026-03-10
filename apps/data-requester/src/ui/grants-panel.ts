import type { GrantInfo, ResourceContent } from "../grant-viewer.js";

export function renderGrantsPanel(
  container: HTMLElement,
  grants: GrantInfo[],
  onViewResource: (resourceUrl: string, grant: GrantInfo) => void
): void {
  if (grants.length === 0) {
    container.innerHTML = `<p class="muted">No granted access yet.</p>`;
    return;
  }

  container.innerHTML = "";

  for (const grant of grants) {
    const card = document.createElement("div");
    card.className = "grant-card";

    const expiry = grant.expiresAt
      ? new Date(grant.expiresAt).toLocaleDateString()
      : "No expiration";

    const resourceList = grant.resourceUrls
      .map((u) => {
        const isContainer = u.endsWith("/");
        const viewBtn = isContainer
          ? `<span class="muted">(container)</span>`
          : `<button class="btn btn-small view-btn" data-url="${escapeHtml(u)}">View</button>`;
        return `<li>
            <span class="resource-url">${escapeHtml(u)}</span>
            ${viewBtn}
          </li>`;
      })
      .join("");

    card.innerHTML = `
      <div class="grant-info">
        <strong>From: ${escapeHtml(grant.ownerWebId)}</strong>
        <p class="grant-meta">
          <span class="mode-badges">${grant.modes.map((m) => `<span class="mode-badge">${m}</span>`).join(" ")}</span>
          <span class="grant-expiry">Expires: ${expiry}</span>
        </p>
        <ul class="grant-resources">${resourceList}</ul>
      </div>
    `;

    card.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = (btn as HTMLElement).dataset.url!;
        onViewResource(url, grant);
      });
    });

    container.appendChild(card);
  }
}

export function renderResourceViewer(
  container: HTMLElement,
  resourceUrl: string,
  content: ResourceContent
): void {
  container.classList.remove("hidden");

  if (content.text !== null) {
    container.innerHTML = `
      <div class="resource-viewer-header">
        <strong>${escapeHtml(resourceUrl)}</strong>
        <span class="muted">(${escapeHtml(content.contentType)})</span>
        <button class="btn btn-small close-viewer-btn">Close</button>
      </div>
      <pre class="resource-viewer-content"><code>${escapeHtml(content.text)}</code></pre>
    `;
  } else {
    const filename = resourceUrl.split("/").pop() || "download";
    container.innerHTML = `
      <div class="resource-viewer-header">
        <strong>${escapeHtml(resourceUrl)}</strong>
        <span class="muted">(${escapeHtml(content.contentType)})</span>
        <button class="btn btn-small close-viewer-btn">Close</button>
      </div>
      <p><a href="${content.blobUrl}" download="${escapeHtml(filename)}" class="btn btn-primary">Download File</a></p>
    `;
  }

  container.querySelector(".close-viewer-btn")!.addEventListener("click", () => {
    container.classList.add("hidden");
    container.innerHTML = "";
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
